const BBOX_MAX_NUM = 16;
const BBOX_WARNING_SIZE = 1280;
const DEFAULT_X = 0.4;
const DEFAULT_Y = 0.4;
const DEFAULT_H = 0.2;
const DEFAULT_W = 0.2;

// ref: https://html-color.codes/
const COLOR_MAP = [
    ['#ff0000', 'rgba(255, 0, 0, 0.3)'],          // red
    ['#ff9900', 'rgba(255, 153, 0, 0.3)'],        // orange
    ['#ffff00', 'rgba(255, 255, 0, 0.3)'],        // yellow
    ['#33cc33', 'rgba(51, 204, 51, 0.3)'],        // green
    ['#33cccc', 'rgba(51, 204, 204, 0.3)'],       // indigo
    ['#0066ff', 'rgba(0, 102, 255, 0.3)'],        // blue
    ['#6600ff', 'rgba(102, 0, 255, 0.3)'],        // purple
    ['#cc00cc', 'rgba(204, 0, 204, 0.3)'],        // dark pink
    ['#ff6666', 'rgba(255, 102, 102, 0.3)'],      // light red
    ['#ffcc66', 'rgba(255, 204, 102, 0.3)'],      // light orange
    ['#99cc00', 'rgba(153, 204, 0, 0.3)'],        // lime green
    ['#00cc99', 'rgba(0, 204, 153, 0.3)'],        // teal
    ['#0099cc', 'rgba(0, 153, 204, 0.3)'],        // steel blue
    ['#9933cc', 'rgba(153, 51, 204, 0.3)'],       // lavender
    ['#ff3399', 'rgba(255, 51, 153, 0.3)'],       // hot pink
    ['#996633', 'rgba(153, 102, 51, 0.3)'],       // brown
];

const RESIZE_BORDER = 5;
const MOVE_BORDER = 5;
//初始化16个空的bbox
let i2i_bboxes = new Array(BBOX_MAX_NUM).fill(null);
//存放元素组件的内容,存储每个bbox的div, bbox, shower对象,其中的bbox_value就是每个i2i_bboxes的值
let boxes_elems = new Array(BBOX_MAX_NUM).fill(null);

function gradioApp() {
    const elems = document.getElementsByTagName('gradio-app')
    const gradioShadowRoot = elems.length == 0 ? null : elems[0].shadowRoot
    return !!gradioShadowRoot ? gradioShadowRoot : document;
}

function initialBboxes(){
    i2i_bboxes = new Array(BBOX_MAX_NUM).fill(null);
    boxes_elems = new Array(BBOX_MAX_NUM).fill(null);
    console.log("上下一张的时候，初始bbox绘图框");
    for(var i = 0 ; i < i2i_bboxes.length ; i++ ){
        const divElement = document.getElementById('MD-bbox-i2i-' + i);
        if (divElement) {divElement.remove();}
        
    }
}

function initialThenUpdateBoxes(json_bboxes_info){
    initialBboxes();
    updateBboxes(json_bboxes_info);
}

function updateBboxes(json_bboxes_info){
    //更新bboxex
    console.log("预测完成，对bboxes进行更新");
    for (let idx = 0; idx < json_bboxes_info.length; idx++) {
        const bbox_info = json_bboxes_info[idx];
        //label_info待使用
        // const label_info = bbox_info.label + ':' + bbox_info.score;
        const label_info = bbox_info.label;
        const one_bbox = [bbox_info.x, bbox_info.y, bbox_info.w, bbox_info.h, label_info];
        //更新i2i_bboxes的值
        i2i_bboxes[idx] = one_bbox;
        //调用onBoxEnableClick(is_t2i, idx, enable)，绘图
        onBoxEnableClick(false, idx, true);
    }
}

function updateCursorStyle(e, is_t2i, idx) {
    //这个函数在鼠标悬停在边界框上时更改光标样式
    if (!i2i_bboxes[idx]) return;

    const div = i2i_bboxes[idx][0];
    if (!(div instanceof HTMLElement)) {
        return;
    }
    const boxRect = div.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const resizeLeft = mouseX >= boxRect.left && mouseX <= boxRect.left + RESIZE_BORDER;
    const resizeRight = mouseX >= boxRect.right - RESIZE_BORDER && mouseX <= boxRect.right;
    const resizeTop = mouseY >= boxRect.top && mouseY <= boxRect.top + RESIZE_BORDER;
    const resizeBottom = mouseY >= boxRect.bottom - RESIZE_BORDER && mouseY <= boxRect.bottom;

    if ((resizeLeft && resizeTop) || (resizeRight && resizeBottom)) {
        div.style.cursor = 'nwse-resize';
    } else if ((resizeLeft && resizeBottom) || (resizeRight && resizeTop)) {
        div.style.cursor = 'nesw-resize';
    } else if (resizeLeft || resizeRight) {
        div.style.cursor = 'ew-resize';
    } else if (resizeTop || resizeBottom) {
        div.style.cursor = 'ns-resize';
    } else {
        div.style.cursor = 'move';
    }
}


function displayBox(canvas, is_t2i, bbox_info) {
    // 绘制和显示bbox
    const [div, bbox, shower, tip] = bbox_info;  //包括一个 <div> 元素、边界框的坐标和大小以及一个回调函数 shower
    const [x, y, w, h, label] = bbox;
    if (!canvas || !div || x == null || y == null || w == null || h == null) { return; }
    //更新提示框的内容
    tip.innerHTML = label;
    // client: canvas widget display size
    // natural: content image real size, 计算边界框在页面上的位置和大小，以便在 canvas 上绘制和显示。
    //画布和真实图像的压缩比
    let vpScale = canvas.naturalHeight / canvas.clientHeight;
    let canvasCenterX = canvas.clientWidth / 2;  //画布宽度的中间点
    let canvasCenterY = canvas.clientHeight / 2;
    let imageWidth = canvas.naturalWidth / vpScale;  //图片的宽度, 图片现在显示的宽度
    let imageHeight = canvas.naturalHeight / vpScale;  //图片的高度，现在显示的高度
    let viewRectLeft = canvasCenterX - imageWidth / 2;  //左侧空白处大小
    let viewRectRight = canvasCenterX + imageWidth / 2;  //画布右侧空白处大小
    let viewRectTop = canvasCenterY - imageHeight / 2;   //画布上面空白处大小
    let viewRectDown = canvasCenterY + imageHeight / 2;

    let xDiv = viewRectLeft + imageWidth * x;   //画布左侧空白处+ 缩放后的宽度*x的位置
    let yDiv = viewRectTop + imageHeight * y;   //画布上面空白处大小+ +缩放后的高度*y的位置
    let wDiv = imageWidth * w; 
    let hDiv = imageHeight * h;

    // Calculate warning bbox size

    div.querySelector('span').style.display = 'block';


    // update <div> when not equal,//更新 <div> 元素的位置和大小，并将其显示在页面上。
    div.style.left = xDiv + 'px';
    div.style.top = yDiv + 'px';
    div.style.width = wDiv + 'px';
    div.style.height = hDiv + 'px';
    div.style.display = 'block';

    // insert it to DOM if not appear
    shower();
}

//is_t2i:boolean, idx:integer, enable:boolean, box是否可见点击
//这段代码定义了一个名为 onBoxEnableClick 的函数，它接受三个参数 is_t2i、idx 和 enable。函数内部首先定义了三个变量 canvas、bboxes 和 locator，它们分别用于存储画布、边界框和定位器的引用。
// 接下来，根据参数 is_t2i 的值，函数会分别将 locator 和 bboxes 设置为不同的值。然后，函数会使用 locator 找到参考边界框的 DIV 元素，并将其子元素中的 img 元素赋给 canvas。如果 canvas 为空，则函数将返回 false。
// 接下来，如果 enable 参数为真，函数会检查边界框数组 bboxes 中是否已经存在索引为 idx 的边界框。如果不存在，则函数会创建一个新的边界框 DIV 元素，并为其设置样式、ID 和事件监听器。然后，函数会将该边界框 DIV 元素、边界框数组和一个用于插入边界框 DIV 元素的函数打包成一个元组，并将其存储在 bboxes 数组的索引为 idx 的位置上。最后，函数会调用 displayBox 函数显示该边界框。
// 如果 enable 参数为假，函数会检查边界框数组 bboxes 中是否已经存在索引为 idx 的边界框。如果存在，则函数会将该边界框的 display 样式设置为 none。最后，函数会返回 false。
function onBoxEnableClick(is_t2i, idx, enable) {
    //函数onBoxEnableClick有三个参数：is_t2i表示是否是从文本到图像的模型，idx是一个整数，表示所选框的索引，enable是一个布尔值，表示框是否应该被启用。
    // yolo预测完成会调用这个函数，如果用户点击bbox启用，也会调用这个函数
    let canvas = null;
    let locator = null;
    let one_box = null;
    //在函数中声明了三个变量。canvas用于保存图片的canvas元素，bboxes用于保存所有的框，locator用于找到保存框的父元素。
    locator = () => gradioApp().querySelector('#MD-bbox-ref-i2i');
    console.log("开启onBoxEnableClick", i2i_bboxes);
    //根据is_t2i的值，选择不同的框和定位器。如果is_t2i为真，将locator设置为查找ID为MD-bbox-ref-t2i的元素，将bboxes设置为t2i_bboxes数组。
    // 否则，将locator设置为查找ID为MD-bbox-ref-i2i的元素，将bboxes设置为i2i_bboxes数组。
    ref_div = locator();
    canvas = ref_div.querySelector('img');  //使用locator查找框的父元素，然后在其中查找img元素。如果找不到，则返回false。
    if (!canvas) { return false; }
    if (enable) {
        // 如果enable为真，则首先检查所选框是否存在。如果不存在，则创建一个新的框。idx是第几个bbox
        if (!i2i_bboxes[idx]) {
            // 初始化新的边界框。使用默认值初始化bbox数组，使用COLOR_MAP数组中的颜色初始化div元素的样式。
            bbox_value = [DEFAULT_X, DEFAULT_Y, DEFAULT_W, DEFAULT_H, "label"];  //eg: [0.1, 0.1, 0.2, 0.2]
        } else {
            bbox_value = i2i_bboxes[idx]
        }
        let div_id = 'MD-bbox-i2i-' + idx; 
        let span_id = 'MD-tip-i2i-' + idx;
        let has_div = gradioApp().querySelector('#'+div_id)
        let has_span = gradioApp().querySelector('#'+span_id)
        if (has_div) {
            div = has_div
            tip = has_span
        } else {
            const colorMap = COLOR_MAP[idx % COLOR_MAP.length];    //颜色 [ "#ff9900","rgba(255, 153, 0, 0.3)"]
            div = document.createElement('div');    //创建一个新的div元素，用于显示边界框。
            div.id = div_id //MD-bbox-i2i-1
            div.style.left = '0px';
            div.style.top = '0px';
            div.style.width = '0px';
            div.style.height = '0px';
            div.style.position = 'absolute';
            div.style.border = '2px solid ' + colorMap[0];
            div.style.background = colorMap[1];
            div.style.zIndex = '900';
            div.style.display = 'none';
            // A text tip to warn the user if bbox is too large
            tip = document.createElement('span');
            tip.id = 'MD-tip-i2i-' + idx;   //创建一个提示MD-tip-i2i-1
            tip.style.right = '0';
            tip.style.top = '0';
            tip.style.position = 'absolute';
            tip.style.transform = 'translate(-50%, -50%)';
            tip.style.fontSize = '12px';
            tip.style.fontWeight = 'bold';
            tip.style.textAlign = 'right';
            tip.style.color = 'rgb(50, 0, 0)';
            tip.style.zIndex = '901';
            tip.style.display = 'none';
            tip.innerHTML = 'label name';   //提示显示的内容
            div.appendChild(tip);
            //创建一个新的文本提示元素，用于在框太大时向用户发出警告。
            div.addEventListener('mousedown', function (e) {
                if (e.button === 0) { onBoxMouseDown(e, is_t2i, idx); }
            });
            div.addEventListener('mousemove', function (e) {
                updateCursorStyle(e, is_t2i, idx);
            });
        }
        shower = function () { // insert to DOM if necessary
            if (!gradioApp().querySelector('#' + div.id)) {
                locator().appendChild(div);
            }
        }
        one_box = [div, bbox_value, shower,tip];
        //更新i2i_bboxes的值
        i2i_bboxes[idx] = bbox_value;
        //显示bboxes
        displayBox(canvas, is_t2i, one_box);
        //放到boxes_elems中
        boxes_elems[idx] = one_box
        return true;
    } else {
        if (!boxes_elems[idx]) { return false; }
        const [div, bbox_value, shower, tip] = boxes_elems[idx];
        div.style.display = 'none';
        return false;
    }
}

function onBoxChange(is_t2i, idx, what, v,label) {
    // 框变化时的操作， 这个函数处理所有bbox的变化，包括拖动和滑块。idx：是第几个bbox，what是：x,y,w,h，中的一个，v是值
    console.log("onBoxChange被请求，参数是: ", is_t2i, idx, what, v);  //更新的哪个： false 5 x 0.39669701213818864
    if (label === "无") {
        // 直接返回v
        console.log("label是无，直接返回v")
        return v
    }
    let canvas = null;
    canvas = gradioApp().querySelector('#MD-bbox-ref-i2i img');
    if (!canvas) {
        switch (what) {
            case 'x': return DEFAULT_X;
            case 'y': return DEFAULT_Y;
            case 'w': return DEFAULT_W;
            case 'h': return DEFAULT_H;
        }
    }
    locator = () => gradioApp().querySelector('#MD-bbox-ref-i2i');
    ref_div = locator();
    if (!i2i_bboxes[idx]) {
        const bbox = [DEFAULT_X, DEFAULT_Y, DEFAULT_W, DEFAULT_H, label];  //eg: [0.1, 0.1, 0.2, 0.2]
        if (what === 'x'){
            bbox[0] = v
        } else if (what === 'y') {
            bbox[1] = v
        } else if (what === 'w') {
            bbox[2] = v
        } else if (what === 'h') {
            bbox[3] = v
        } 
        const colorMap = COLOR_MAP[idx % COLOR_MAP.length];    //颜色 [ "#ff9900","rgba(255, 153, 0, 0.3)"]
        const div = document.createElement('div');    //创建一个新的div元素，用于显示边界框。
        div.id = 'MD-bbox-i2i-' + idx;   //MD-bbox-i2i-1
        div.style.left = '0px';
        div.style.top = '0px';
        div.style.width = '0px';
        div.style.height = '0px';
        div.style.position = 'absolute';
        div.style.border = '2px solid ' + colorMap[0];
        div.style.background = colorMap[1];
        div.style.zIndex = '900';
        div.style.display = 'block';
        // A text tip to warn the user if bbox is too large
        const tip = document.createElement('span');
        tip.id = 'MD-tip-i2i-' + idx;   //创建一个提示MD-tip-i2i-1
        // 从中间50%，改成左上角
        tip.style.right = '0';
        tip.style.top = '0';
        tip.style.position = 'absolute';
        tip.style.transform = 'translate(-50%, -50%)';
        tip.style.fontSize = '12px';
        tip.style.fontWeight = 'bold';
        //文本的位置，现在是中间，改成左上角
        tip.style.textAlign = 'right';
        //颜色改成黑色
        tip.style.color = 'rgb(50, 0, 0)';
        tip.style.zIndex = '901';
        tip.style.display = 'block';
        tip.innerHTML = "label";   //提示显示的内容
        div.appendChild(tip);
        //创建一个新的文本提示元素，用于在框太大时向用户发出警告。
        div.addEventListener('mousedown', function (e) {
            if (e.button === 0) { onBoxMouseDown(e, false, idx); }
        });
        div.addEventListener('mousemove', function (e) {
            updateCursorStyle(e, false, idx);
        });

        const shower = function () { // insert to DOM if necessary
            if (!gradioApp().querySelector('#' + div.id)) {
                locator().appendChild(div);
            }
        }
        boxes_elems[idx] = [div, bbox, shower,tip]
    }

    //获取第idx个bbox的div元素，bbox数组和shower函数
    const [div, bbox, shower,tip] = boxes_elems[idx]; //[ div#MD-bbox-i2i-5, [0.4, 0.4, 0.2, 0.2], ƒ ()]
    if (div.style.display === 'none') { return v; }
    //第5个idx是标签的名称
    bbox[4] = label;
    // 如果存在，直接赋值
    switch (what) {
        case 'x': bbox[0] = v; break;
        case 'y': bbox[1] = v; break;
        case 'w': bbox[2] = v; break;
        case 'h': bbox[3] = v; break;
    }
    //更新div元素的样式
    console.log("更新boxes_elems");
    //更新bbox的值
    i2i_bboxes[idx] = bbox;
    displayBox(canvas, is_t2i, boxes_elems[idx]);
    return v;
}

function onBoxMouseDown(e, is_t2i, idx) {
    let canvas = null;
    canvas = gradioApp().querySelector('#MD-bbox-ref-i2i img');
    // Get the bounding box
    if (!canvas || !boxes_elems[idx]) { return; }
    const [div, bbox, shower, tip] = boxes_elems[idx];

    // Check if the click is inside the bounding box
    if (!(div instanceof HTMLElement)) {
        return;
    }
    const boxRect = div.getBoundingClientRect();
    let mouseX = e.clientX;
    let mouseY = e.clientY;

    const resizeLeft = mouseX >= boxRect.left && mouseX <= boxRect.left + RESIZE_BORDER;
    const resizeRight = mouseX >= boxRect.right - RESIZE_BORDER && mouseX <= boxRect.right;
    const resizeTop = mouseY >= boxRect.top && mouseY <= boxRect.top + RESIZE_BORDER;
    const resizeBottom = mouseY >= boxRect.bottom - RESIZE_BORDER && mouseY <= boxRect.bottom;

    const moveHorizontal = mouseX >= boxRect.left + MOVE_BORDER && mouseX <= boxRect.right - MOVE_BORDER;
    const moveVertical = mouseY >= boxRect.top + MOVE_BORDER && mouseY <= boxRect.bottom - MOVE_BORDER;

    if (!resizeLeft && !resizeRight && !resizeTop && !resizeBottom && !moveHorizontal && !moveVertical) { return; }

    const horizontalPivot = resizeLeft ? bbox[0] + bbox[2] : bbox[0];
    const verticalPivot = resizeTop ? bbox[1] + bbox[3] : bbox[1];

    // Canvas can be regarded as invariant during the drag operation
    // Calculate in advance to reduce overhead

    // Calculate viewport scale based on the current canvas size and the natural image size
    let vpOffset = canvas.getBoundingClientRect();
    let scaledX = canvas.naturalWidth;
    let scaledY = canvas.naturalHeight;

    // Calculate the canvas center and view rectangle coordinates
    let canvasCenterX = (vpOffset.left + window.scrollX) + canvas.clientWidth / 2;
    let canvasCenterY = (vpOffset.top + window.scrollY) + canvas.clientHeight / 2;
    let viewRectLeft = canvasCenterX - scaledX / 2 - window.scrollX;
    let viewRectRight = canvasCenterX + scaledX / 2 - window.scrollX;
    let viewRectTop = canvasCenterY - scaledY / 2 - window.scrollY;
    let viewRectDown = canvasCenterY + scaledY / 2 - window.scrollY;

    mouseX = Math.min(Math.max(mouseX, viewRectLeft), viewRectRight);
    mouseY = Math.min(Math.max(mouseY, viewRectTop), viewRectDown);

    const accordion = gradioApp().querySelector(`#MD-accordion-i2i-${idx}`);

    // Move or resize the bounding box on mousemove
    function onMouseMove(e) {
        // Prevent selecting anything irrelevant
        e.preventDefault();

        // Get the new mouse position
        let newMouseX = e.clientX;
        let newMouseY = e.clientY;

        // clamp the mouse position to the view rectangle
        newMouseX = Math.min(Math.max(newMouseX, viewRectLeft), viewRectRight);
        newMouseY = Math.min(Math.max(newMouseY, viewRectTop), viewRectDown);

        // Calculate the mouse movement delta
        const dx = (newMouseX - mouseX) / scaledX;
        const dy = (newMouseY - mouseY) / scaledY;

        // Update the mouse position
        mouseX = newMouseX;
        mouseY = newMouseY;

        // if no move just return
        if (dx === 0 && dy === 0) { return; }

        // Update the mouse position
        let [x, y, w, h] = bbox;
        if (moveHorizontal && moveVertical) {
            // If moving the bounding box
            x = Math.min(Math.max(x + dx, 0), 1 - w);
            y = Math.min(Math.max(y + dy, 0), 1 - h);
        } else {
            // If resizing the bounding box
            if (resizeLeft || resizeRight) {
                if (x < horizontalPivot) {
                    if (dx <= w) {
                        // If still within the left side of the pivot
                        x = x + dx;
                        w = w - dx;
                    } else {
                        // If crossing the pivot
                        w = dx - w;
                        x = horizontalPivot;
                    }
                } else {
                    if (w + dx < 0) {
                        // If still within the right side of the pivot
                        x = horizontalPivot + w + dx;
                        w = - dx - w;
                    } else {
                        // If crossing the pivot
                        x = horizontalPivot;
                        w = w + dx;
                    }
                }

                // Clamp the bounding box to the image
                if (x < 0) {
                    w = w + x;
                    x = 0;
                } else if (x + w > 1) {
                    w = 1 - x;
                }
            }
            // Same as above, but for the vertical axis
            if (resizeTop || resizeBottom) {
                if (y < verticalPivot) {
                    if (dy <= h) {
                        y = y + dy;
                        h = h - dy;
                    } else {
                        h = dy - h;
                        y = verticalPivot;
                    }
                } else {
                    if (h + dy < 0) {
                        y = verticalPivot + h + dy;
                        h = - dy - h;
                    } else {
                        y = verticalPivot;
                        h = h + dy;
                    }
                }
                if (y < 0) {
                    h = h + y;
                    y = 0;
                } else if (y + h > 1) {
                    h = 1 - y;
                }
            }
        }
        const [div, old_bbox, _, tip] = boxes_elems[idx];

        // If all the values are the same, just return
        if (old_bbox[0] === x && old_bbox[1] === y && old_bbox[2] === w && old_bbox[3] === h) { return; }
        // else update the bbox
        const event = new Event('input');
        const coords = [x, y, w, h];
        // <del>The querySelector is not very efficient, so we query it once and reuse it</del>
        // caching will result gradio bugs that stucks bbox and cannot move & drag
        const sliderIds = ['x', 'y', 'w', 'h'];
        // We try to select the input sliders
        const sliderSelectors = sliderIds.map(id => `#MD-i2i-${idx}-${id} input`).join(', ');
        let sliderInputs = accordion.querySelectorAll(sliderSelectors);
        if (sliderInputs.length == 0) {
            // If we failed, the accordion is probably closed and sliders are removed in the dom, so we open it
            accordion.querySelector('.label-wrap').click();
            // and try again
            sliderInputs = accordion.querySelectorAll(sliderSelectors);
            // If we still failed, we just return
            if (sliderInputs.length == 0) { return; }
        }
        for (let i = 0; i < 4; i++) {
            if (old_bbox[i] !== coords[i]) {
                sliderInputs[2 * i].value = coords[i];
                sliderInputs[2 * i].dispatchEvent(event);
            }
        }
    }

    // Remove the mousemove and mouseup event listeners
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    // Add the event listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}



function onCreateI2IRefClick() {
    const canvas = gradioApp().querySelector('#img2img_image img');
    return canvas.src;
}

function onBoxLocked(v) {
    return v
}


function updateBoxes(is_t2i) {
    // 重绘所有的bbox
    let canvas = null;

    canvas = gradioApp().querySelector('#MD-bbox-ref-i2i img');
    if (!canvas) return;

    for (let idx = 0; idx < i2i_bboxes.length; idx++) {
        if (!i2i_bboxes[idx]) continue;
        const [div, bbox, shower, tip] = boxes_elems[idx];
        if (div.style.display === 'none') { return; }

        displayBox(canvas, is_t2i, boxes_elems[idx]);
    }
}


function previousButtonClick() {
  var continueButton = document.querySelector("#prev_btn");
  if (continueButton) {
    continueButton.click(); // 触发点击事件
  }
}

function nextButtonClick() {
  var continueButton = document.querySelector("#next_btn");
  if (continueButton) {
    continueButton.click(); // 触发点击事件
  }
}

function queryButtonClick() {
  var continueButton = document.querySelector("#query_btn");
  if (continueButton) {
    continueButton.click(); // 触发点击事件
  }
}

function skipButtonClick() {
  var continueButton = document.querySelector("#skip_btn");
  if (continueButton) {
    continueButton.click(); // 触发点击事件
  }
}


// 监听键盘按下事件，如果按下回车键，则模拟点击继续按钮
document.addEventListener('keydown', function(event) {
  if (event.keyCode === 87) {
        // w是上一张
    previousButtonClick();
  }else if (event.keyCode === 83) {
      //  s是下一张
    nextButtonClick();
  }else if (event.keyCode === 81) {
        // q是查询
    queryButtonClick();
  }else if (event.keyCode === 74) {
        // j是跳过
    skipButtonClick();
  }
});

window.addEventListener('resize', _ => {
    updateBoxes(true);
    updateBoxes(false);
});

window.addEventListener('DOMNodeInserted', e => {
    if (!e) { return; }
    if (!e.target) { return; }
    if (!e.target.classList) { return; }
    if (!e.target.classList.contains('label-wrap')) { return; }

    for (let tab of ['i2i']) {
        const div = gradioApp().querySelector('#MD-bbox-control-' + tab + ' div.label-wrap');
        if (!div) { continue; }
        updateBoxes(tab === 't2i');
    }
});
