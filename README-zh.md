BBox标注工具

本工具是一个基于 Gradio 工具开发的 BBox 标注工具，灵感来自于 https://github.com/pkuliyi2015/multidiffusion-upscaler-for-automatic1111。
功能

![screenshot](display1.png)
![screenshot](display2.png)

本工具实现了以下功能：

    图片由本地图片搜索改成根据后台请求获取，方便对线上已标注的品牌和 BBox 的数量进行控制。
    标注数据调用后台 API，存储到 MySQL 数据库。
    用户通过品牌进行搜索，返回同一品牌下未标注的商品，相同的商品名称按顺序返回。
    根据 BBox 数量限制搜索返回的图片，我们可以优先标注简单的商品，这样模型学习后在辅助标注复杂的商品。
    上一张和下一张的按钮会优先搜索已标注的数据库，如果存在，那么直接返回，如果不存在，在使用 YOLO 进行辅助标注。
    下一张按钮会自动触发当前页面的标注数据保存，并搜索下一张图片。
    用户可以输入精确或模糊的商品名称查询，会自动调用图片搜索 API 进行商品图搜索，方便用户标注时进行对比。
    更改 BBox 的名称为颜色的名称，方便用户一下就定位到要修改的 BBox。
    修改图片上显示的标签为左上角，方便查看。
    添加 W 和 S 的键盘快捷键，当用户点击 W 时，表示点击了上一张，S 表示点击了下一张，加快标注速度。
    当用户点击上一张或下一张的时候，同时自动更新参考的显示图片，自动显示最可能的商品的图片，方便用户校对。
    涉及的 API 和页面，一共 2 个 API，一个是 YOLO 的模型目标检测 API，方便后台图片搜索 API 调用，图片搜索 API 链接线上库，搜索未标注商品和保存已标注信息到数据库等，Gradio 页面负责显示 BBox 的查询商品。
    增加处理分支，如果是品牌加上线上后台特殊字典，返回线上后台的唯一的商品链接，例如欧莱雅线上后台。
    增加跳过按钮。
    快捷键跳过 J、查询 Q、上一张 W、下一张 S。
    显示多个候选的 BBox 的预测结果，当用户点击链接时，自动显示链接。

注意事项

当启用一个新的 BBox 时，标签为 "无" 时无法移动，需要修改标签为一个新的名称才可以。
使用方法

    安装依赖：pip install -r requirements.txt
    启动 Gradio 应用：python app.py
    打开浏览器，访问 http://localhost:7860

# API

本工具使用了两个 API：

    YOLO 的模型目标检测 API
    后台图片搜索 API

# 运行
pip install gradio
python bbox_labeling.py