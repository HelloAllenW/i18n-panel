import ExtractorAbstract, { ExtractorSupportedExtension, ExtractorOptions, ExtractorResult } from './base'
import { workspace, Range } from 'vscode'
import { parse as babelParse } from '@babel/parser'
import traverse from '@babel/traverse'
import { extractFromText, extractFromPlainText } from './rules'

export class BabelExtractor extends ExtractorAbstract {
    public readonly id = ExtractorSupportedExtension.JS

    public readonly extractorRuleOptions = {
        importanceAttributes: [],
        ignoreAttributes: ['class', 'className', 'key', 'style', 'ref', 'onClick'],
        importanceBind: [],
        ignoreBind: []
    }

    private ignores: [number, number][] = []

    async extractor({ uri }: ExtractorOptions): Promise<ExtractorResult[]> {
        const document = await workspace.openTextDocument(uri || this.uri)
        if (!document) return []
        const code = document.getText()
        const ast = babelParse(code, {
            sourceType: 'module',
            plugins: [
                'jsx',
                'typescript',
                'decorators-legacy'
            ]
        })
        const words: ExtractorResult[] = []
        traverse(ast, {
            StringLiteral: (path) => {
                const { value, start: fullStart, end: fullEnd } = path.node
                if (!fullStart || !fullEnd) { return }
                if (this.isIgnored(fullStart, fullEnd) || path.findParent(p => p.isImportDeclaration())) { return }
                extractFromText(value).forEach(t => {
                    const start = code.indexOf(t, fullStart)
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
                        isJsx: true,
                        type: 'js-string'
                    })
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
                            const start = code.indexOf(t, item.start)
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
                                isJsx: true,
                                type: 'js-template'
                            })
                        }
                    })
                })
            },
            JSXText: (path) => {
                const { value, start: fullStart } = path.node
                if (!fullStart) return
                extractFromPlainText(value).forEach(t => {
                    const start = code.indexOf(t, fullStart)
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
                        isJsx: true,
                        type: 'jsx-text'
                    })
                })
            },
            JSXElement: (path: any) => {
                path?.node?.openingElement?.attributes?.forEach((i: any) => {
                    if (this.extractorRuleOptions.ignoreAttributes.includes(i?.name?.name)) { this.recordIgnore(i) }
                })
            },
        })
        this.ignores = []
        console.log('提取js、ts中的中文: ', words)
        return words
    }

    isIgnored(start: number, end: number) {
        return this.ignores.find(([s, e]) => (s <= start && start <= e) || (s <= end && end <= e)) != null
    }

    recordIgnore(path: any) {
        const fullStart = path?.node?.start ?? path?.start
        const fullEnd = path?.node?.end ?? path?.end

        if (!fullStart || !fullEnd) { return }

        this.ignores.push([fullStart, fullEnd])
    }
}
