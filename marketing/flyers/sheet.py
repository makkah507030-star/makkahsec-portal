import sys
from PIL import Image
key, ts = sys.argv[1], sys.argv[2:]
ims=[Image.open(f'snap-{key}-{t}.png') for t in ts]
W=Image.new('RGB',(540*3,960*((len(ims)+2)//3)))
for i,im in enumerate(ims): W.paste(im,((i%3)*540,(i//3)*960))
W.save(f'sheet-{key}.png')
