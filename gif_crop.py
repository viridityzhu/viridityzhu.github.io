from PIL import Image, ImageSequence

def crop_gif_left(input_path, output_path):
    # Open the GIF file
    img = Image.open(input_path)

    # Calculate the new width
    percent = 0.5
    new_width = int(img.width * percent)
    percent = 0.93
    new_height = int(img.height * percent)

    # Create a list to hold the frames
    frames = []

    # Iterate over each frame in the GIF
    for frame in ImageSequence.Iterator(img):
        # Make sure the frame is in RGBA format to handle transparency
        frame = frame.convert("RGBA")

        # Crop the frame to the new width
        cropped_frame = frame.crop((0, 0, new_width, new_height))

        # Append the cropped frame to the list
        frames.append(cropped_frame)

    # Save the frames as a new GIF
    frames[0].save(output_path, save_all=True, append_images=frames[1:], optimize=False, duration=img.info['duration'], loop=0)

# Example usage
input_gif = '/Users/jiayinzhu/Downloads/3dmm-teaser.gif'
output_gif = '/Users/jiayinzhu/Downloads/3dmm-teaser-cropped.gif'
crop_gif_left(input_gif, output_gif)
print('done')
