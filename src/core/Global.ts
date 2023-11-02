import type { ExtensionContext, WorkspaceFolder } from 'vscode'
import { workspace, window } from 'vscode'
import { ConfigLocalesGuide } from './../commands/configLocalePaths'
import { LocaleLoader } from './loaders/LocaleLoader'
import { AvailableParsers } from './../parsers'
import { Log } from './../utils'
import Config from './Config'

export class Global {
    // 在 TypeScript 中，泛型 `Record<string, any>` 表示一个键为字符串类型，值为任意类型的对象。
    private static _loaders: Record<string, LocaleLoader> = {}

    private static _rootPath: string

    private static _currentWorkspaceFolder: WorkspaceFolder

    static context: ExtensionContext

    // 在插件激活的時候進行了調用
    static async init(context: ExtensionContext) {
        this.context = context

        // 打開/關閉/切換 窗口時進行updateRootPath
        context.subscriptions.push(workspace.onDidChangeWorkspaceFolders(() => this.updateRootPath()))
        context.subscriptions.push(window.onDidChangeActiveTextEditor(() => this.updateRootPath()))
        context.subscriptions.push(workspace.onDidOpenTextDocument(() => this.updateRootPath()))
        context.subscriptions.push(workspace.onDidCloseTextDocument(() => this.updateRootPath()))
        context.subscriptions.push(workspace.onDidChangeConfiguration(() => this.update()))
        await this.updateRootPath()
    }

    static get rootPath() {
        return this._rootPath
    }

    static set rootPath(path: string) {
        this._rootPath = path
    }

    static get loader() {
        return this._loaders[this.rootPath]
    }

    static get localesPath(): string | undefined {
        let config

        if (this._currentWorkspaceFolder) { config = Config.getLocalesPathsInScope(this._currentWorkspaceFolder) } else { config = Config.localesPath }
        return config
    }

    static get callFunctionName(): string {
        return Config.callFunctionName
    }

    static set callFunctionName(name: string) {
        Config.updatecallFunctionName(name)
    }

    static async update() {
        const hasLocalesSet = !!Global.localesPath

        if (!hasLocalesSet) {
            ConfigLocalesGuide.autoSet()
            this.unloadAll()
        } else {
            await this.initLoader(this.rootPath)
        }
    }

    private static unloadAll() {
        Object.values(this._loaders).forEach(loader => loader.dispose())
        this._loaders = {}
    }

    private static async initLoader(rootPath: string, reload = false) {
        if (!rootPath) { return }

        if (this._loaders[rootPath] && !reload) { return this._loaders[rootPath] }

        const loader = new LocaleLoader(rootPath)
        await loader.init()
        this.context.subscriptions.push(loader)
        this._loaders[rootPath] = loader

        return this._loaders[rootPath]
    }

    private static async updateRootPath() {
        const editor = window.activeTextEditor
        let rootPath = ''

        if (!editor || !workspace.workspaceFolders || workspace.workspaceFolders.length === 0) { return }

        const resource = editor.document.uri
        if (resource.scheme === 'file') {
            const folder = workspace.getWorkspaceFolder(resource)
            if (folder) {
                this._currentWorkspaceFolder = folder
                rootPath = folder.uri.fsPath
            }
        }

        if (!rootPath && workspace.workspaceFolders[0].uri.fsPath) { rootPath = workspace.workspaceFolders[0].uri.fsPath }

        if (rootPath && rootPath !== this.rootPath) {
            this.rootPath = rootPath

            Log.divider()
            Log.info(`💼 Workspace root changed to "${rootPath}"`)

            await this.update()
        }`-`
    }

    static getMatchedParser(ext: string) {
        if (!ext.startsWith('.') || !ext.includes('.')) return
        const id = ext.slice(1)
        return AvailableParsers.find(parser => parser.id === id)
    }
}
