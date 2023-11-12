import type { ExtensionContext, Uri } from 'vscode'
import type { ExtractorResult } from '../extractors/base'
import type { Dictionary, PendingWrite, PendingWriteParsed } from '.'
import type { InserterId } from '../inserters/base'
import { workspace, window } from 'vscode'
import { extname } from 'path'
import { unflatten } from 'flat'
import { Global, Workbench, EventTypes } from '.'
import Config from './Config'
import { findLanguage } from './../utils'
import { Extractor } from '../extractors'
import { Translator } from './Translator'
import { Inserter } from '../inserters'

export class CurrentFile {
    static uri: Uri | undefined

    static _extractor: Extractor | null = null

    static _extractor_result: ExtractorResult[]

    static watch(ctx: ExtensionContext) {
        ctx.subscriptions.push(workspace.onDidSaveTextDocument(e => this.uri && e?.uri === this.uri && this.update(e.uri)))
        ctx.subscriptions.push(workspace.onDidChangeTextDocument(e => this.uri && e?.document.uri === this.uri && this.update(e.document.uri)))
        ctx.subscriptions.push(window.onDidChangeActiveTextEditor(e => e?.document.uri && this.update(e.document.uri)))
        if (window.activeTextEditor) { this.update(window.activeTextEditor.document.uri) }
    }

    static update(uri: Uri) {
        this.uri = uri
        if (this._extractor?.id !== this.id) { this._extractor = new Extractor(uri) }
        this.extract()
    }

    static get id() {
        if (this.uri) { return extname(this.uri.fsPath) }
        return ''
    }

    static get extractorResult() {
        return this._extractor_result
    }

    static set extractorResult(value) {
        this._extractor_result = value
    }

    static get pendingWrite() {
        // Global.loader: 通过类名来调用静态方法
        const { allLocales, languageMapFile } = Global.loader
        const from = findLanguage(Config.sourceLanguage)
        const storage: string[] = []

        return this.extractorResult.reduce<PendingWrite[]>((result, item) => {
            const options = allLocales.reduce<{
                insertPath: Record<string, string>
                languages: PendingWrite['languages']
            }>((_, locale) => {
                _.languages[locale] = locale === from ? item.text : ''
                const [defaultIntertPath] = languageMapFile[locale]
                _.insertPath[locale] = defaultIntertPath
                return _
            }, {
                insertPath: {},
                languages: {}
            })
            const storageText = options.languages[from]
            if (!storage.includes(storageText)) {
                result.push({
                    key: '',
                    ...options
                })
            }
            storage.push(storageText)
            return result
        }, [])
    }

    /**
     * @param currentEditor
     */
    static async extract() {
        if (this._extractor) {
            const result = await this._extractor.extract({
                id: this.id,
                uri: this.uri
            })
            this.extractorResult = result // 当前文件所有的中文数据
        }
        console.log('extractorResult', this.extractorResult)
        // 没用
        Workbench.sendMessage({
            type: EventTypes.READY,
        })

        // 批量自动翻译
        if (this.extractorResult.length > 0) {
            setTimeout(()=>{
                this.autoTransAll();
            }, 500)
        }
    }

    // 自动翻译所有
    static autoTransAll() {
        console.log('开始翻译...')
        this.extractorResult.forEach((item, index) => {
            Workbench.sendMessage({
                type: EventTypes.TRANSLATE_SINGLE,
                data: {
                    index,
                    text: item.text,
                },
            })
            if (index === this.extractorResult.length - 1) {
                console.log('批量翻译完成')
            }
        })
    }

    // 写入国际化文件
    static write(data: any) {
        const pendingWrite = this.handlePendingWrite(JSON.parse(data) as PendingWrite[])
        const files = Object.keys(pendingWrite)
        Promise.all(
            files.map(file => {
                const { flattenData } = pendingWrite[file]
                const ext = extname(file)
                const inserterId = ext.substring(1)
                return Inserter.insert(inserterId as InserterId, file, flattenData)
            })
        )
    }

    static handlePendingWrite(data: PendingWrite[]) {
        const pendingWriteParsed = data.reduce<Dictionary<PendingWriteParsed>>((result, item) => {
            const { languages:{ key }, insertPath, languages } = item
            const rootKey = key.split('.')[0]
            if (key && rootKey) {
                Object.keys(item.insertPath).forEach(locale => {
                    if (typeof insertPath === 'object') {
                        if (!result[insertPath[locale]]) {
                            result[insertPath[locale]] = {
                                rootKeys: [],
                                unFlattenData: {},
                                flattenData: {}
                            }
                        }
                        result[insertPath[locale]].rootKeys.push(rootKey)
                        result[insertPath[locale]].flattenData[key] = languages[locale]
                        result[insertPath[locale]].unFlattenData = unflatten(result[insertPath[locale]].flattenData)
                    }
                })
            }
            return result
        }, {})
        return pendingWriteParsed
    }

    static async translate(text: string) {
        const { allLocales } = Global.loader // allLocales: ['en', 'zh-CN']
        const from = findLanguage(Config.sourceLanguage) // zh-CN
        const result = await Translator.translate(from, text, allLocales)
        // {en: 'Static in-line international copywriting', zh-CN: '静态的行内国际化文案'}
        return Promise.resolve(result)
    }
}
