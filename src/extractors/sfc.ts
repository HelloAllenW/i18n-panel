/**
 * 解析vue单文件组件，获取里面的所有中文
 */
import ExtractorAbstract, { ExtractorSupportedExtension, ExtractorOptions, ExtractorResult } from './base'
import { workspace, Range } from 'vscode'
import {
    TemplateChildNode,
    ElementNode,
    AttributeNode,
    DirectiveNode,
    InterpolationNode,
    SimpleExpressionNode,
    ExpressionNode,
    isText,
    baseParse as parse,
} from '@vue/compiler-core'
import { ParserPlugin, parse as babelParse } from '@babel/parser'
import traverse from '@babel/traverse'
import { isIdentifier } from '@babel/types'
import { shouldExtract, extractFromText, extractFromPlainText } from './rules'
import { TEMPLATE_STRING } from '../meta'

export class SfcExtractor extends ExtractorAbstract {
    public readonly id = ExtractorSupportedExtension.VUE

    public readonly extractorRuleOptions = {
        importanceAttributes: ['bind', 'title', 'name', 'label', 'placeholder', 'tooltip', 'tip'],
        ignoreAttributes: ['class', 'id', 'style'],
        importanceBind: ['bind', 'title', 'name', 'label', 'placeholder', 'tooltip', 'tip'],
        ignoreBind: []
    }

    async extractor({ uri }: ExtractorOptions): Promise<ExtractorResult[]> {
        this.document = await workspace.openTextDocument(uri || this.uri)
        const code = this.document.getText()
        const ast = parse(code, {
            getTextMode: ({ tag, props }, parent) => {
                if (
                    (!parent && tag !== 'template')
                    || (tag === 'template'
                        && props.some(
                            p =>
                                p.type === 6
                                && p.name === 'lang'
                                && p.value
                                && p.value.content
                                && p.value.content !== 'html'
                        ))
                ) return 2
                return 0
            },
        })
        const result: ExtractorResult[] = []
        ast.children.forEach(node => {
            if (node.type !== 1) { return } // NODETYPES.ELEMENT
            switch (node.tag) {
                case 'template':
                    this.createExtractorResult(node).forEach(item => result.push(item))
                    break
                case 'script':
                    this.createExtractorResult(node).forEach(item => result.push(item))
                    break
                default:
                    break
            }
        })
        return result
    }

    isVBind(p: ElementNode['props'][0]): p is DirectiveNode {
        return p.type === 7
    }

    isProp(p: ElementNode['props'][0]): p is AttributeNode {
        return p.type === 6
    }

    isInterPolation(p: TemplateChildNode): p is InterpolationNode {
        return p.type === 5
    }

    isSimpleExpressionNode(p: ExpressionNode): p is SimpleExpressionNode {
        return p.type === 4
    }

    parseTemplateText(templateNode: TemplateChildNode) {
        const { document } = this
        if (!document) return []

        const { source } = templateNode.loc
        const words: ExtractorResult[] = []
        const visitorAttr = (node: DirectiveNode) => {
            const { exp } = node
            if (exp && this.isSimpleExpressionNode(exp)) {
                const { loc, content } = exp
                extractFromText(content).forEach(t => {
                    const start = source.indexOf(t, loc.start.offset)
                    const end = start + t.length
                    const range = new Range(
                        document.positionAt(start),
                        document.positionAt(end)
                    )
                    const isTemplate = source.match(TEMPLATE_STRING)?.some(i => `\`${i}\``.includes(t))
                    words.push({
                        id: this.id,
                        text: t,
                        start,
                        end,
                        range,
                        isDynamic: true,
                        type: isTemplate ? 'html-attribute-template' : 'html-attribute'
                    })
                })
            }
        }
        const visitor = (node: TemplateChildNode) => {
            if (isText(node)) {
                if (!this.isInterPolation(node)) {
                    // source中包含 \n
                    const { loc } = node
                    extractFromPlainText(loc.source).forEach(t => {
                        const start = source.indexOf(t, loc.start.offset)
                        const end = start + t.length
                        const range = new Range(
                            document.positionAt(start),
                            document.positionAt(end)
                        )
                        words.push({
                            id: this.id,
                            text: t,
                            start,
                            end,
                            range,
                            type: 'html-inline'
                        })
                    })
                } else if (this.isSimpleExpressionNode(node.content)) {
                    const { content, loc } = node.content
                    extractFromText(content).forEach(t => {
                        const start = source.indexOf(t, loc.start.offset)
                        const end = start + t.length
                        const range = new Range(
                            document.positionAt(start),
                            document.positionAt(end)
                        )
                        const isTemplate = content.match(TEMPLATE_STRING)?.some(i => `\`${i}\``.includes(t))
                        words.push({
                            id: this.id,
                            text: t,
                            start,
                            end,
                            range,
                            isDynamic: true,
                            type: isTemplate ? 'html-inline-template' : 'html-inline'
                        })
                    })
                }
            }
            if (node.type === 1) {
                node.props.forEach(inlineNode => {
                    if (this.isVBind(inlineNode)) {
                        if (!this.extractorRuleOptions.importanceBind.includes(inlineNode.name)) return
                        visitorAttr(inlineNode)
                    }

                    if (this.isProp(inlineNode)) {
                        if (!this.extractorRuleOptions.importanceAttributes.includes(inlineNode.name)) return
                        const { loc, value, name: attrName } = inlineNode // name="xxx"
                        if (value) {
                            const {
                                loc: {
                                    start: { offset }
                                },
                                content
                            } = value
                            const start = offset + 1
                            const end = offset + 1 + content.length
                            const fullStart = loc.start.offset
                            const fullEnd = loc.end.offset
                            const range = new Range(
                                document.positionAt(start),
                                document.positionAt(end)
                            )
                            const fullRange = new Range(
                                document.positionAt(fullStart),
                                document.positionAt(fullEnd)
                            )
                            words.push({
                                id: this.id,
                                text: content,
                                start,
                                end,
                                range,
                                fullText: loc.source,
                                fullStart,
                                fullEnd,
                                fullRange,
                                attrName,
                                type: 'html-attribute'
                            })
                        }
                    }
                })

                const _node = node.children
                _node.forEach(visitor)
            }
        }
        visitor(templateNode)
        console.log('提取vue組件中template中的中文', words)
        return words
    }

    parseJsText(scriptNode: TemplateChildNode) {
        const { document } = this
        if (!document) return []
        if (scriptNode.type !== 1) return []

        const words: ExtractorResult[] = []
        const plugins: ParserPlugin[] = []
        let isSetup: ExtractorResult['isSetup'] = false
        scriptNode.props.forEach(p => {
            if (p.type === 6) {
                if (p.name === 'lang') {
                    const lang = (p.value && p.value.content) ?? ''
                    const isTs = ['ts', 'tsx'].includes(lang)
                    if (lang === 'tsx') { plugins.push('jsx') }

                    if (isTs) { plugins.push('typescript', 'decorators-legacy') }
                }
                if (p.name === 'setup') { isSetup = true }
            }
        })

        for (let i = 0; i < scriptNode.children.length; i++) {
            const { source, start: { offset } } = scriptNode.children[i].loc
            const ast = babelParse(source, {
                plugins,
                sourceType: 'module'
            })
            traverse(ast, {
                Program: {
                    enter(path) {
                        path.traverse({
                            ObjectMethod(path) {
                                const { key } = path.node
                                if (isIdentifier(key)) { isSetup = key.name === 'setup' }
                            }
                        })
                    }
                },
                StringLiteral: (path) => {
                    const { value, start, end } = path.node
                    if (!shouldExtract(value)) return
                    if (!start || !end) return
                    if (path.findParent(p => p.isImportDeclaration())) return
                    const range = new Range(
                        document.positionAt(offset + start + 1),
                        document.positionAt(offset + end - 1)
                    )
                    words.push({
                        id: this.id,
                        text: value,
                        start,
                        end,
                        range,
                        isSetup,
                        type: 'js-string'
                    })
                },
                TemplateLiteral: (path) => {
                    if (path.findParent(p => p.isImportDeclaration())) return
                    const value = path.get('quasis').map(item => ({
                        text: item.node.value.raw,
                        start: item.node.start
                    }))
                    value.forEach(item => {
                        extractFromText(item.text).forEach(t => {
                            if (item.start) {
                                const start = source.indexOf(t, item.start)
                                const end = start + t.length
                                const range = new Range(
                                    document.positionAt(start + offset),
                                    document.positionAt(end + offset)
                                )
                                words.push({
                                    id: this.id,
                                    text: t,
                                    start,
                                    end,
                                    range,
                                    isDynamic: true,
                                    isSetup,
                                    type: 'js-template'
                                })
                            }
                        })
                    })
                }
            })
        }
        console.log('提取vue組件中script中的中文: ', words)
        return words
    }

    createExtractorResult(node: ElementNode) {
        const { tag } = node
        if (tag === 'template') { return this.parseTemplateText(node) }
        if (tag === 'script') { return this.parseJsText(node) }
        return []
    }
}
