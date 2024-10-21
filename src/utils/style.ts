// 从指定的元素和属性中获取RGB颜色值
function getRGB(selector: string, property: string): { R: number, G: number, B: number } {
    // 使用document.querySelector选择元素
    let elem = document.querySelector(selector);
    // 如果元素不存在，返回默认的RGB值（0,0,0）
    if (!elem) return { R: 0, G: 0, B: 0 };

    // 获取元素的样式属性值，并匹配出数字部分
    let rgb = window.getComputedStyle(elem, null)
        .getPropertyValue(property) // 获取样式属性值
        .match(/\d+/g) // 匹配所有数字
        .map(v => parseInt(v)); // 将数字字符串转换为整数

    // 返回RGB对象
    return { R: rgb[0], G: rgb[1], B: rgb[2] };
}

// 获取页面的宽度和高度
function getPageSize(): { pageW: number, pageH: number } {
    // 获取document.body的宽度和高度样式值
    let w = window.getComputedStyle(document.body, null).getPropertyValue("width");
    let h = window.getComputedStyle(document.body, null).getPropertyValue("height");
    // 匹配数字并转换为整数，返回页面尺寸对象
    return {
        pageW: parseInt(w.match(/\d+/)[0]),
        pageH: parseInt(h.match(/\d+/)[0]),
    };
}

// 根据容器大小、元素大小、事件位置和内边距计算优化后的位置
function optimizedPos(
    containerSize: { h: number, w: number },
    elemSize: { h: number, w: number },
    eventPos: { x: number, y: number },
    xPadding: number,
    yPadding: number,
): { x: number, y: number } {
    let x: number = 0, y: number = 0;
    // 判断元素应该放置在容器的右侧
    if (containerSize.w - eventPos.x - xPadding - elemSize.w > 0) { 
        x = eventPos.x + xPadding;
        y = eventPos.y < containerSize.h / 2 ?
            Math.min(eventPos.y, (containerSize.h - elemSize.h) / 2) :
            Math.max(eventPos.y - elemSize.h, (containerSize.h - elemSize.h) / 2);
    } 
    // 判断元素应该放置在容器的左侧
    else if (eventPos.x - xPadding - elemSize.w > 0) { 
        x = eventPos.x - xPadding - elemSize.w;
        y = eventPos.y < containerSize.h / 2 ?
            Math.min(eventPos.y, (containerSize.h - elemSize.h) / 2) :
            Math.max(eventPos.y - elemSize.h, (containerSize.h - elemSize.h) / 2);
    } 
    // 判断元素应该放置在容器的上方
    else if (eventPos.y - elemSize.h - yPadding > 0) { 
        x = eventPos.x < containerSize.w / 2 ?
            Math.min(eventPos.x, (containerSize.w - elemSize.w) / 2) :
            Math.max(eventPos.x - elemSize.w, (containerSize.w - elemSize.w) / 2);
        y = eventPos.y - yPadding - elemSize.h;
    } 
    // 默认情况，元素放置在容器的下方
    else { 
        x = eventPos.x < containerSize.w / 2 ?
            Math.min(eventPos.x, (containerSize.w - elemSize.w) / 2) :
            Math.max(eventPos.x - elemSize.w, (containerSize.w - elemSize.w) / 2);
        y = eventPos.y + yPadding;
    }
    // 返回计算后的位置对象
    return { x, y };
}

export { getRGB, getPageSize, optimizedPos };