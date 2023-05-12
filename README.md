# gradio_bbox_labeling
BBox Annotation Tool

![screenshot](display1.png)
![screenshot](display2.png)

This tool is a BBox annotation tool developed using Gradio tool, inspired by https://github.com/pkuliyi2015/multidiffusion-upscaler-for-automatic1111.
Features
## This tool implements the following features:
* Images are obtained by backend requests instead of local image search, making it easier to control the number of brands and BBoxes already annotated online.
* The annotation data is stored in a MySQL database and called using a backend API.
* Users can search for unannotated items of the same brand, and items with the same name are returned in order.
* The search results for images are limited by the number of BBoxes, allowing simpler items to be annotated first so that the model can assist in annotating more complex items.
* The "previous" and "next" buttons will first search the annotated database. If the image is found, it will be returned directly. If not, YOLO will be used for assistance annotation.
* The "next" button will automatically trigger the current page's annotation data to be saved and search for the next image.
    Users can search for precise or fuzzy product names, and the image search API will automatically search for comparison images to facilitate annotation.
    The name of the BBox is changed to the name of the color, making it easier for users to locate the BBox they want to modify.
    The label displayed on the image is changed to the upper left corner for easy viewing.
    The "W" and "S" keyboard shortcuts are added. Clicking "W" represents the "previous" button and "S" represents the "next" button, which speeds up the annotation process.
    When the "previous" or "next" button is clicked, the reference image displayed is automatically updated, and the image of the most likely product is automatically displayed, making it easier for users to verify.
    There are 2 APIs involved in this tool: YOLO's model target detection API, which facilitates the backend image search API call, and the image search API links to the online database, searching for unannotated items and saving annotated information to the database. The Gradio page is responsible for displaying the BBox and querying products.
    A processing branch is added. If it is a brand, a special dictionary from the backend will be added, and the unique product link from the backend will be returned, such as the L'Oreal backend.
    A "skip" button is added.
    Keyboard shortcuts: skip "J", query "Q", previous "W", next "S"
    Multiple candidate BBox prediction results are displayed, and when the user clicks on a link, the link is automatically displayed.

# Notes
When a new BBox is enabled, it cannot be moved if the label is "none". You need to change the label to a new name before you can move it.


# How to run
```
pip install gradio
python bbox_labeling.py
```

