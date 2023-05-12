#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Date  : 2023/4/25 11:37
# @File  : bbox_labeling.py
# @Author: 
# @Desc  : bbox框的标注工具
"""
1. 支持上一张，下一张图片翻页按钮
2. 支持bbox的框的绘制，支持bbox的框的移动，bbox的框的缩放，bbox的标签
3. 图片来自本地文件夹，bbox的标注信息保存到本地文件夹
4. 如果已有bbox的标注信息，可以直接加载，继续标注
5. 如果没有bbox的标注信息，会通过bbox的检测算法，自动检测bbox的位置，自动给出一个可能的bbox的标注标签
6. 支持查看搜索目标图像，方便对比标注
7. 只有点下一张的时候保存当前的标注信息,当bboxes有信息是，才会保存
8. 点击上一张的时候，自动加载已经保存的json标注信息，加载后并显示
9. 上一张按钮快捷键w，下一张快捷键s
"""

import os
import time
import pandas as pd
import requests
import base64
import json
import gradio as gr
import mimetypes
from PIL import Image
from enum import Enum
from pathlib import Path

mimetypes.init()
mimetypes.add_type("application/javascript", ".js")

BBOX_COLOR = ['红色','橙色','黄色','绿色','青色','蓝色','紫色','深粉色','浅红色','浅橙色','酸橙色','青柠色','钢青色','淡钢青色','淡紫色','热粉色','棕色']

def gr_show(visible=True):
    return {"visible": visible, "__type__": "update"}


class ScriptLoader:
    path_map = {
        "js": os.path.abspath(os.path.join(os.path.dirname(__file__), "javascript")),  # 指定加载js脚本的路径
        "py": os.path.abspath(os.path.join(os.path.dirname(__file__), "python"))  # 指定加载python脚本的路径
    }

    # 父类，支持加载javascript脚本和python脚本
    def __init__(self, script_type):
        self.script_type = script_type  # 'js'
        self.path = ScriptLoader.path_map[script_type]  # '/opt/lang/javascript'
        self.loaded_scripts = []  # eg: 最后被加载的具体的js的内容存放在这里

    @staticmethod
    def get_scripts(path: str, file_type: str) -> list[tuple[str, str]]:
        """Returns list of tuples
        每个元祖包含完整的文件路径和文件名
        """
        scripts = []
        dir_list = [os.path.join(path, f) for f in os.listdir(path)]  # 获取所有的脚本文件,eg: ['/opt/lang/javascript/t1.js']
        files_list = [f for f in dir_list if os.path.isfile(f)]  # 不要目录，只要文件,eg: ['/opt/lang/disney/javascript/bboxHint.js']
        for s in files_list:
            # Dont forget the "." for file extension
            if os.path.splitext(s)[1] == f".{file_type}":  # 只要js文件的后缀类型
                scripts.append((s, os.path.basename(s)))  # [('/opt/lang/javascript/t1.js', 't1.js')]
        return scripts


class JavaScriptLoader(ScriptLoader):
    def __init__(self):
        # 初始化父类，这个是指定加载js脚本
        super().__init__("js")
        # 复制一下原来的模板
        self.original_template = gr.routes.templates.TemplateResponse
        # Prep the js files
        self.load_js()
        # 把修改后的模板赋值给你的 gradio，方便调用
        gr.routes.templates.TemplateResponse = self.template_response

    def load_js(self):
        js_scripts = ScriptLoader.get_scripts(self.path,
                                              self.script_type)  # 获取所有的js脚本,eg:[('/opt/lang/javascript/t1.js', 't1.js')]
        for file_path, file_name in js_scripts:
            # file_name: t1.js, file_type: '/opt/lang/javascript/t1.js'
            with open(file_path, 'r', encoding="utf-8") as file:  # 读取js文件
                self.loaded_scripts.append(f"\n<!--{file_name}-->\n<script>\n{file.read()}\n</script>")

    def template_response(self, *args, **kwargs):
        """
        一旦gradio调用你的方法，你就调用原来的，你修改它包含你的脚本，然后你返回修改后的版本
        header里面包含你的脚本，返回给gradio
        """
        response = self.original_template(*args, **kwargs)
        response.body = response.body.replace(
            '</head>'.encode('utf-8'), f"{''.join(self.loaded_scripts)}\n</head>".encode("utf-8")
        )
        response.init_headers()
        return response


class BlendMode(Enum):  # i.e. LayerType
    # 区分前景色和背景色
    FOREGROUND = 'Foreground'
    BACKGROUND = 'Background'

    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            return self.value == other
        elif isinstance(other, BlendMode):
            return self.value == other.value
        else:
            raise TypeError(f'unsupported type: {type(other)}')


def get_one_images(brand="资生堂", idx=0, bbox_num=-1, topk=4):
    """
    只获取jpg格式的图片
    """
    # res = {'data': {'bbox_candidates': [[{'label': '欧莱雅新多重防护隔离液 水感倍护', 'url': 'http://192.168.50.189:7794/api/image/2018'}, {'label': '欧莱雅新多重防护隔离露 水感轻肌', 'url': 'http://192.168.50.189:7794/api/image/1227'}, {'label': '欧莱雅新多重防护隔离液 水感倍护', 'url': 'http://192.168.50.189:7794/api/image/2019'}, {'label': '欧莱雅新多重防护隔离液 水感倍护', 'url': 'http://192.168.50.189:7794/api/image/2017'}], [{'label': '欧莱雅多重防护隔离露 素颜亮采', 'url': 'http://192.168.50.189:7794/api/image/2034'}, {'label': '欧莱雅多重防护隔离露 素颜亮采', 'url': 'http://192.168.50.189:7794/api/image/2035'}, {'label': '欧莱雅小光圈喷雾', 'url': 'http://192.168.50.189:7794/api/image/572'}, {'label': '欧莱雅小光圈喷雾', 'url': 'http://192.168.50.189:7794/api/image/573'}], [{'label': '欧莱雅新多重防护隔离露 外御内护', 'url': 'http://192.168.50.189:7794/api/image/865'}, {'label': '欧莱雅新多重防护隔离露 外御内护', 'url': 'http://192.168.50.189:7794/api/image/866'}, {'label': '欧莱雅防脱精华液（小黑喷）', 'url': 'http://192.168.50.189:7794/api/image/1533'}, {'label': '欧莱雅清润葡萄籽水嫩洁面乳', 'url': 'http://192.168.50.189:7794/api/image/453'}], [{'label': '欧莱雅多重防护隔离露 素颜亮采', 'url': 'http://192.168.50.189:7794/api/image/2034'}, {'label': '欧莱雅多重防护隔离露 素颜亮采', 'url': 'http://192.168.50.189:7794/api/image/2035'}, {'label': '欧莱雅小光圈喷雾', 'url': 'http://192.168.50.189:7794/api/image/573'}, {'label': '欧莱雅小光圈喷雾', 'url': 'http://192.168.50.189:7794/api/image/572'}]], 'bbox_num': 4, 'bboxes': [[243.12725830078125, 236.93186950683594, 384.913330078125, 798.8110961914062], [617.3644409179688, 537.275146484375, 689.0697021484375, 793.4158935546875], [392.7101745605469, 274.6469421386719, 526.1124267578125, 779.217041015625], [546.1234130859375, 518.9520874023438, 618.5255737304688, 779.0012817382812]], 'brand': '欧莱雅', 'classes': ['欧莱雅新多重防护隔离液 水感倍护', '欧莱雅多重防护隔离露 素颜亮采', '欧莱雅新多重防护隔离露 外御内护', '欧莱雅多重防护隔离露 素颜亮采'], 'idx': 0, 'pic': 'https://img.alicdn.com/bao/uploaded/i2/533497499/O1CN013lPzGf25GarIgfTLm_!!0-item_pic.jpg', 'pic_height': 800, 'pic_path': '/home/wac/johnson/.cache/torch/mmf/data/datasets/retrieval_tmall/images/欧莱雅多重防护隔离露外御内护SPF50+/PA++++/5b982513c60f299b65a1758cbb1e543e.jpg', 'pic_width': 800, 'product': '欧莱雅新多重防护隔离露 外御内护', 'product_img': 'http://img.lavector.com/lavectorimages/da38d7c5c89b3726c2b390aab912be6d.jpg', 'scores': [0.8991537094116211, 0.891562283039093, 0.8848311305046082, 0.8565376996994019], 'title': '欧莱雅防晒小金管面部身体防晒霜隔离霜保湿防紫外线防晒乳SPF50+', 'total': 919, 'url': 'https://detail.tmall.com/item.htm?id=589262335068&skuId=4987740194300&user_id=533497499&cat_id=2&is_b=1&rn=55405dcc52257da2e15b82337a6861fc'}, 'has_label': False, 'msg': 'success', 'status': 0}
    return res

def do_query(query_txt):
    """
    根据query_txt进行查询
    Args:
        query_txt (): 产品名称或别名,"资生堂新男士焕能紧致眼霜"
    Returns:
    """
    picture_url = data["picture_url"]  #'http://img.lavector.com/lavectorimages/da38d7c5c89b3726c2b390aab912be6d.jpg'
    official_name = data["official_name"]  #'欧莱雅新多重防护隔离露 外御内护'
    return official_name, picture_url

def get_first_image():
    """
    获取第一张图片，占位显示用
    Returns:
    """
    img_path = "tempdir/2e60fe6c7adb6308c89a81e4f28605fe.jpg"
    assert os.path.exists(img_path), f"图片不存在: {img_path}"
    img_array = show_img(img_path)
    return img_array

def show_img(path):
    return Image.open(path)

def save_bbox_api(data):
    """
    保存bbox信息到mysql
    Args:
        data ():
    Returns:
    """
    url = f"http://{IMAGE_API}:{IMAGE_PORT}/api/save_bbox"
    # 提交form格式数据
    headers = {'content-type': 'application/json'}
    post_data = {"data": data, "person": True}
    # 提交form格式数据
    try:
        r = requests.post(url, data=json.dumps(post_data), headers=headers)
    except Exception as e:
        print(e)
        print(f"注意：请检查服务器是否开启，或者检查网络是否正常：{url}")
    res = r.json()
    msg = res["msg"]
    assert res["status"] == 0, f"有报错信息，请检查,{msg}"
    return res

def get_save_next_image(bbox_num,brand_name,picture_info, pred_img, img_path, *args):
    """
    保存当前的图片信息到json文件中，然后获取下一张图片的基本信息，并返回
    bbox_num:限制返回的图片包含的bbox数量
    picture_info:是当前的商品信息，即标题
    pred_img:是当前的预测图片, ndarry格式
    img_path:是当前的图片路径
    kwargs:是所有的参数，包括bbox_controls
    根据num获取下一个图片
    """
    if not brand_name:
        raise gr.Error(f"没有给定品牌的名称，请给定一个品牌名称")
    print(f"获取下一张图片,当前的序号是: {num}")
    # 上一张图片的信息
    if img_path:
        print(f"保存上一张图片的信息")
        bboxes = []
        # bbox, product_info, x, y, w, h,一共是6个参数一组，所以要除以6一定是整数
        bbox_controls_length = len(args)
        assert bbox_controls_length % 6 == 0, "bbox_controls的长度必须是6的倍数"
        for i in range(0, bbox_controls_length, 6):
            # 一个bbox的信息
            bbox = args[i:i + 6]
            bbox_enabled = bbox[0]
            if bbox_enabled:
                label = bbox[1]
                x = bbox[2]
                y = bbox[3]
                w = bbox[4]
                h = bbox[5]
                bbox = {
                    "label": label,
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                }
                bboxes.append(bbox)
        # 遍历所有的bbox_controls，如果第一个参数Bbox是True，那么就保留
        height, width = pred_img.shape[:2]
        data = {
            "image_path": img_path,
            "url": picture_info,
            "bboxes": bboxes,
            "width": width,
            "height": height,
        }
        # 如果图片存在，就保存当前的图片信息到json文件中，如果不存在就不保存,json文件和图片是一一对应的
        save_bbox_api(data)
    return just_get_next_image(bbox_num,brand_name)

def just_get_next_image(bbox_num,brand_name):
    global num
    images_info = get_one_images(brand_name, num, bbox_num)
    images_data = images_info["data"]
    image_idx = images_data["idx"]
    total_num = images_data["total"]
    num = image_idx + 1
    if num > total_num:
        raise gr.Error(f"当前品牌的数据已经是最后一张图片了，当前的序号是: {image_idx}")
    img_path = images_data["pic_path"]
    title = images_data["title"]
    product = images_data["product"]  # 产品名称,以前标注的产品名称
    product_img = images_data["product_img"]  #我们的目标图片
    url = images_data["url"]  #店铺的链接
    assert os.path.exists(img_path), f"图片不存在: {img_path}"
    img = show_img(img_path)
    bboxes = images_data["bboxes"]
    classes = images_data["classes"]
    scores = images_data["scores"]
    pic_height = images_data["pic_height"]
    pic_width = images_data["pic_width"]
    bbox_candidates = images_data["bbox_candidates"]  # 每个bbox的多个候选可能的商品
    #下一张的图片信息
    bbox_controls, json_res, table_display = bboxes_format(bboxes, scores, classes, pic_height,pic_width,bbox_candidates)
    # 需要对bbox_controls展开返回，因为gradio的接收列表的参数
    target_name = product
    target_img = product_img
    return target_name,target_img,url, title, img, img_path,json_res, *bbox_controls, *table_display

def get_last_image(bbox_num,brand_name):
    """
    根据num获取上一个图片,和上一张图片的标注信息
    """
    global num
    print(f"获取上一张图片,当前的序号是: {num}")
    num -= 1
    if num < 0:
        raise gr.Error(f"当前品牌的数据已经是第一张图片了，当前的序号是: {num}")
    images_info = get_one_images(brand_name, num, bbox_num)
    images_data = images_info["data"]
    img_path = images_data["pic_path"]
    title = images_data["title"]
    product = images_data["product"]  # 产品名称,以前标注的产品名称
    product_img = images_data["product_img"]  #我们的目标图片
    url = images_data["url"]  # 店铺的链接
    img = show_img(img_path)
    bboxes = images_data["bboxes"]
    classes = images_data["classes"]
    scores = images_data["scores"]
    pic_height = images_data["pic_height"]
    pic_width = images_data["pic_width"]
    bbox_candidates = images_data["bbox_candidates"]  # 每个bbox的多个候选可能的商品
    # 每个都变成Dataframe格式
    bbox_controls, json_res, table_display = bboxes_format(bboxes, scores, classes, pic_height,pic_width,bbox_candidates)
    # 需要对bbox_controls展开返回，因为gradio的接收列表的参数
    # json_res, *bbox_controls是来自已有的缓存的json文件, 如果没有缓存文件，那么就是默认数据
    target_name = product
    target_img = product_img
    return target_name,target_img,url, title, img, img_path,json_res, *bbox_controls, *table_display

def get_image_size(img_path):
    """
    获取图片的大小
    """
    img = Image.open(img_path)
    width, height = img.size
    return width, height

def gr_value(value=None):
    return {"value": value, "__type__": "update"}

def bboxes_format(bboxes, scores, classes,height, width, bbox_candidates):
    """
    bboxes格式制作
    bbox_candidates: BBOX_MAX_NUM个bbox的候选标签列表
    """
    # 当预测的图片没有那么多bbox的时候，给个默认值, bbox, prodoct_info, x, y, w, h
    default_bbox = [False, "无", 0.4, 0.4, 0.2, 0.2]
    default_candidates = [] # 默认显示候选的标签
    num_boxes = len(bboxes)
    table_display = []
    bbox_controls = []
    json_res_list = []  # 存储到json_res一份, 只存储真实存在的bbox内容，
    # 确保每个bbox都有被操作，即使没有值
    if len(bboxes) > BBOX_MAX_NUM:
        print(f"bbox数量超过{BBOX_MAX_NUM}个，只取前{BBOX_MAX_NUM}个")
    for i in range(BBOX_MAX_NUM):
        if i < num_boxes:
            candidates = bbox_candidates[i]
            candidates = pd.DataFrame(candidates)
            table_display.append(candidates)
            product = classes[i] #第i个bbox的类别名称
            score = scores[i] #第i个bbox的分数
            # 存在的bbox，取出来,bbox默认格式是[x1, y1, x2, y2], 转换成[x, y, w, h], 并且需要归一化，分别除以图片的宽和高
            bbox = bboxes[i]
            x = bbox[0]/width   #6.38/1080
            y = bbox[1]/height  #274.3/894
            w = (bbox[2] - bbox[0])/width   #315.18-6.38  /1080 == 0.291
            h = (bbox[3] - bbox[1])/height  #816.3-274.3 / 849 == 0.659
            bbox_controls.extend([True, product, x, y, w, h])
            json_res_list.append({
                "label": product,
                "score": round(score, 2),
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "width": width,
                "height": height,
            })
        else:
            # 没有那么多的bbox，给个默认值
            bbox_controls.extend(default_bbox)
            table_display.append(default_candidates)
    #嵌套的格式，返回，bbox, prodoct_info, x, y, w, h
    # 导出成json的个是
    json_res = json.dumps(json_res_list)
    return [gr_value(v) for v in bbox_controls] ,json_res, table_display

IMAGE_API = "192.168.50.189"
IMAGE_PORT = 6656
num = 0  # 计数

BBOX_MAX_NUM = 6
is_t2i = 'false'
js_loader = JavaScriptLoader()
theme = gr.themes.Soft(
    primary_hue="sky",
)
with gr.Blocks(analytics_enabled=False,theme=theme) as demo:
    with gr.Row(variant='compact', visible=True):
        with gr.Column(scale=3):
            bbox_controls = []  # control set for each bbox
            table_display = []
            picture_info = gr.Textbox(label='图片来源', value="", elem_id='picture-index')
            title = gr.Textbox(label='图片标题', value="", elem_id='picture-title')
            img_path = gr.Textbox(label='图片路径', visible=False, elem_id='picture-index')
            # 显示图片,elem_id被js查找,.style(height=400)
            pred_img = gr.Image(value=get_first_image(), label="预测图片", elem_id="MD-bbox-ref-i2i")
            for i in range(BBOX_MAX_NUM):
                # Only when displaying & png generate info we use index i+1, in other cases we use i
                with gr.Accordion(BBOX_COLOR[i], open=False, elem_id=f'MD-accordion-i2i-{i}'):
                    with gr.Row(variant='compact'):
                        bbox = gr.Checkbox(label=f'启用', value=False,elem_id=f'MD-i2i-{i}-enable',info="注意，当标签是无时无法对bbox移动操作")
                        bbox.change(fn=None, inputs=bbox, outputs=bbox, _js=f'e => onBoxEnableClick({is_t2i}, {i}, e)')
                        prodoct_info = gr.Text(label='标签', value="无", elem_id=f'MD-i2i-{i}-product')

                    with gr.Row(variant='compact',visible=True):
                        x = gr.Slider(label='x', value=0.4, minimum=0.0, maximum=1.0, step=0.01,
                                      elem_id=f'MD-i2i-{i}-x')
                        y = gr.Slider(label='y', value=0.4, minimum=0.0, maximum=1.0, step=0.01,
                                      elem_id=f'MD-i2i-{i}-y')

                    with gr.Row(variant='compact',visible=True):
                        w = gr.Slider(label='w', value=0.2, minimum=0.0, maximum=1.0, step=0.01,
                                      elem_id=f'MD-i2i-{i}-w')
                        h = gr.Slider(label='h', value=0.2, minimum=0.0, maximum=1.0, step=0.01,
                                      elem_id=f'MD-i2i-{i}-h')
                        # 更改产品，也需要刷新页面
                        prodoct_info.change(fn=None, inputs=[x, prodoct_info], outputs=x,
                                 _js=f'(v,p) => onBoxChange({is_t2i}, {i}, "x", v,p)')
                        # 点的位置会被修改，修改bbox是，这些都会被修改
                        x.change(fn=None, inputs=[x,prodoct_info], outputs=x, _js=f'(v,p) => onBoxChange({is_t2i}, {i}, "x", v,p)')
                        y.change(fn=None, inputs=[y,prodoct_info], outputs=y, _js=f'(v,p )=> onBoxChange({is_t2i}, {i}, "y", v,p)')
                        w.change(fn=None, inputs=[w,prodoct_info], outputs=w, _js=f'(v,p) => onBoxChange({is_t2i}, {i}, "w", v,p)')
                        h.change(fn=None, inputs=[h,prodoct_info], outputs=h, _js=f'(v,p) => onBoxChange({is_t2i}, {i}, "h", v,p)')


                    def on_select(evt: gr.SelectData):
                        image_url = evt.value
                        print(f"显示图片为{image_url}")
                        return image_url
                    with gr.Row(variant='compact',visible=True):
                        table = gr.Dataframe(elem_id=f'MD-i2i-{i}-table')
                        image = gr.Image(label="显示点击的图片", elem_id=f"MD-reference-{i}-image").style(height=200)
                        table.select(on_select, None, image)
                control = [bbox, prodoct_info, x, y, w, h]
                table_display.append(table)
                # 方便对每个bbox进行操作, 这里不能用append，因为append会报错：AttributeError: 'list' object has no attribute '_id'
                bbox_controls.extend(control)
        with gr.Column(scale=1):
            with gr.Row(scale=0.5):
                brand_name = gr.Textbox(label='品牌名称', value="", elem_id='brand-index',placeholder="eg:欧莱雅")
                bbox_num = gr.Dropdown(list(range(-1, 7)), default=-1, label="bbox数量", info="限制返回的图片含有的商品的数量，默认不限制", elem_id="bbox-num")
            # 显示一个目标图片
            target_img = gr.Image(label="目标图片", elem_id="target-img")
            target_name = gr.Textbox(label='目标名称', value="目标图片", elem_id='target-index')
            # 如果不正确，需要输入一个正确的标签
            query_txt = gr.Text(lines=1, placeholder='可以查询一个图片标签', label='查询名称')
            # 查询按钮，快捷键q
            query_btn = gr.Button(value='查询', variant='tool', elem_id="query_btn")
            # 存储结果，传给js使用
            json_res = gr.JSON(label="bbox info", visible=False, elem_id="json_res")
            with gr.Row():
                # 上一张，下一张按钮, 快捷键w,s,j
                prev_btn = gr.Button(value='上一张', variant='tool', elem_id="prev_btn")
                next_btn = gr.Button(value='下一张', variant='tool', elem_id="next_btn")
                skip_btn = gr.Button(value='跳过', variant='tool', elem_id="skip_btn")
    # 当点击上一张或一张的按钮时，更新bbox的值
    # 对于输出的bbox_controls，我们只更新了gradio中的值，界面上也进行了显示，但是js中的画布没有激活，需要激活后才能显示标注框
    # 利用js事先激活画布，predict_btn重绘Bbox
    # 保存当前的Bbox信息，和获取下一张图片的信息,如果不存在本地bbox，就预测bbox信息， 不直接重绘，因为图片不显示的话，不能直接重绘
    next_btn.click(get_save_next_image, [bbox_num,brand_name, picture_info, pred_img,img_path,*bbox_controls], [target_name,target_img,picture_info, title,pred_img, img_path,json_res,*bbox_controls,*table_display]).then(fn=None,inputs=json_res,outputs=None,_js="initialThenUpdateBoxes")
    skip_btn.click(just_get_next_image, [bbox_num,brand_name], [target_name,target_img,picture_info, title,pred_img, img_path,json_res,*bbox_controls,*table_display]).then(fn=None,inputs=json_res,outputs=None,_js="initialThenUpdateBoxes")
    # 获取上一张的图片信息和bbox信息，然后重绘bbox,
    prev_btn.click(get_last_image, [bbox_num,brand_name], [target_name,target_img,picture_info, title, pred_img, img_path,json_res,*bbox_controls,*table_display]).then(fn=None,inputs=json_res,outputs=None,_js="initialThenUpdateBoxes")
    query_btn.click(do_query,[query_txt],[target_name, target_img])
demo.launch(server_name="0.0.0.0",server_port=7878)
