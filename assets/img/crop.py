from PIL import Image
from os import path


def trim_and_resize(img_path, target_width, save_path=None):
    # Load image
    img = Image.open(img_path)

    # Ensure alpha channel for transparent margin detection
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Trim transparent margins
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Compute new width to preserve aspect ratio
    aspect_ratio = img.height / img.width
    new_height = int(target_width * aspect_ratio)

    # Resize image
    resized_img = img.resize((target_width, new_height), Image.LANCZOS)

    if save_path:
        resized_img.save(save_path)
    return resized_img


# Example usage
filenames = [f"circle{i}.png" for i in range(11)]

target_widths = []
for i in range(11):
    target_widths.append(Image.open(f"/home/cloudmosa/suika-game/images/{i}.png").width)

for i, filename in enumerate(filenames):
    trim_and_resize(
        filename, target_width=target_widths[i], save_path=path.join("./out", filename)
    )
