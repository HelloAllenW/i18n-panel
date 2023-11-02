import { JsonParser } from './json'
import { EcmascriptParser } from './ecmascript'

export const DefaultEnabledParsers = ['json', 'yaml', 'json5']

export const AvailableParsers = [
    // 解析項目中的所有json、js、ts資源文件
    new JsonParser(),
    new EcmascriptParser('js'),
    new EcmascriptParser('ts'),
]
