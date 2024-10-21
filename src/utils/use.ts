// 导入 Vue 3 的 onMounted, onBeforeUnmount, unref 函数
import { onMounted, onBeforeUnmount, unref } from "vue";
// 导入 Ref 类型，用于类型注解
import type { Ref } from "vue";
// 导入 EventMap 类型，用于类型注解
import type { EventMap } from "@/constant";

// 定义 useEvent 函数，它是一个泛型函数，T 代表 EventMap 的键的类型
function useEvent<T extends keyof EventMap>(
    // elRef 参数可以是 Ref<EventTarget> 或者直接是 EventTarget 对象
    elRef: Ref<EventTarget> | EventTarget,
    // type 参数是事件的类型，它是 EventMap 的一个键
    type: T,
    // listener 参数是事件处理函数，它的参数类型是 EventMap[T] 所对应的类型
    listener: (ev: EventMap[T]) => void
) {
    // 在组件挂载时执行的函数
    onMounted(() => {
        // 使用 unref 解决 ref，然后添加事件监听器
        unref(elRef).addEventListener(type, listener);
    });
    // 在组件卸载前执行的函数
    onBeforeUnmount(() => {
        // 使用 unref 解决 ref，然后移除事件监听器
        unref(elRef).removeEventListener(type, listener);
    });
}

// 导出 useEvent 函数
export { useEvent };