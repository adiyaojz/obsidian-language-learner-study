import { ItemView, WorkspaceLeaf, } from 'obsidian';
import { createApp, App } from 'vue';

import MainPlugin from "@/plugin";
import { t } from "@/lang/helper";
import Stat from './Stat.vue';

export const STAT_ICON: string = "bar-chart-4";
export const STAT_VIEW_TYPE: string = 'langr-stat';

export class StatView extends ItemView {
    vueApp: App;
    plugin: MainPlugin;
    constructor(leaf: WorkspaceLeaf, plugin: MainPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType(): string {
        return STAT_VIEW_TYPE;
    }
    getDisplayText(): string {
        return t("Statistics");
    }
    getIcon(): string {
        return STAT_ICON;
    }
    async onOpen() {
        // 获取容器元素的第二个子元素（假设第一个子元素可能是其他内容，这里选择第二个子元素，可能是特定的视图内容区域）
        const container = this.containerEl.children[1];
        // 在这个子元素上创建一个带有特定类名 "langr-stat" 的 div 元素
        let content = container.createDiv({ cls: "langr-stat" });
    
        // 创建一个 Vue 应用实例
        this.vueApp = createApp(Stat);
        // 将创建的 div 元素设置为 Vue 应用实例的全局属性，以便在 Vue 组件中访问
        this.vueApp.config.globalProperties.container = content;
        // 将插件实例设置为 Vue 应用实例的全局属性，以便在 Vue 组件中访问
        this.vueApp.config.globalProperties.plugin = this.plugin;
        // 将 Vue 应用实例挂载到创建的 content 元素上
        this.vueApp.mount(content);
    }
    
    async onClose() {
        // 当视图关闭时，卸载 Vue 应用实例，清理相关资源
        this.vueApp.unmount();
    }
}