// 插件入口文件
import { ExtensionContext } from 'vscode'
import { EXT_NAMESPACE } from './meta'
import Config from './core/Config'
import { CurrentFile, Global } from './core'
import { Log } from './utils'
import registerCommand from './commands'

// 一旦你的插件激活，vscode会立刻调用下述方法，只会在你的插件激活时执行一次
export function activate(context: ExtensionContext) {
    Config.extName = EXT_NAMESPACE
    Config.ctx = context
    Log.info(`🌞 ${Config.extensionName} Activated`)

    Global.init(context)
    CurrentFile.watch(context)

    registerCommand(context)
}

// this method is called when your extension is deactivated
export function deactivate() { }
