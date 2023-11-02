import type { DirStructure, PendingWrite } from './../core'
import { ComputedRef } from 'vue'
import { reactive, toRefs, computed } from 'vue'
import { EventTypes } from './events'
// 存储变量
interface WorkbenchStore {
    config: {
        allLocales: string[]
        dirStructure: DirStructure
        sourceLanguage: string
        languageMapFile: Record<string, string[]>
        pendingWrite: PendingWrite[]
    }
    allLocales: Partial<ComputedRef<string[]>>
    dirStructure: Partial<ComputedRef<DirStructure>>
    sourceLanguage: Partial<ComputedRef<string>>
    languageMapFile: Partial<ComputedRef<Record<string, string[]>>>
    pendingWrite: Partial<ComputedRef<PendingWrite[]>>
}

// 暴露给App.vue，让其可以使用postMessage
export const vscode = window.acquireVsCodeApi()

export const store: WorkbenchStore = reactive<WorkbenchStore>({
    config: {
        allLocales: [],
        dirStructure: '',
        sourceLanguage: '',
        languageMapFile: {},
        pendingWrite: []
    },
    allLocales: computed(() => store.config.allLocales),
    sourceLanguage: computed(() => store.config.sourceLanguage),
    dirStructure: computed(() => store.config.dirStructure),
    languageMapFile: computed(() => store.config.languageMapFile),
    pendingWrite: computed(() => store.config.pendingWrite),
})

export function useWorkbenchStore() {
    function effectView(message: any) {
        const { value, index } = message.data
        store.config.pendingWrite[index].languages = value
    }
    // 在监听的workbench.ts中初始化一些基本数据
    vscode.postMessage({ type: EventTypes.READY })
    // 监听
    window.addEventListener('message', (event) => {
        const message = event.data
        switch (message.type) {
            case EventTypes.CONFIG:
                store.config = message.data
                break
            case EventTypes.TRANSLATE_SINGLE:
                // 翻译完成，更新视图
                effectView(message)
                break
            default:
                break
        }
    })
    return {
        ...toRefs(store)
    }
}
