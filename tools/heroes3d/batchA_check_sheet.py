from PIL import Image, ImageDraw, ImageFont, ImageOps
S='/workspace/xfer/e5/mA7/'; K='/workspace/factory-briefs/slime-docs/sketches/epic/'
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',26); f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
except: F=f=ImageFont.load_default()
def bbox_crop(im, pad=12):
    g=im.convert('L'); m=g.point(lambda v:255 if v<128 else 0); b=m.getbbox()
    return im.crop((max(0,b[0]-pad),max(0,b[1]-pad),min(im.width,b[2]+pad),min(im.height,b[3]+pad)))
def fit(im,w,h,bg=(255,255,255)):
    im=im.copy(); im.thumbnail((w,h),Image.LANCZOS); c=Image.new('RGB',(w,h),bg)
    if im.mode=='RGBA': c.paste(im,((w-im.width)//2,(h-im.height)//2),im)
    else: c.paste(im,((w-im.width)//2,(h-im.height)//2))
    return c
def small(im, px=90):
    b=bbox_crop(im,4); r=px/b.height; s=b.resize((max(1,int(b.width*r)),px),Image.LANCZOS); return s
heroes=[('water_epic_pell','Ferryman Pell'),('fire_epic_brann','Signal-Fire Brann'),('plant_epic_comb','Mother Comb')]
CW=[560,300,130,300,300]; RH=340; TOP=90
W_=sum(CW)+20*(len(CW)+1); out=Image.new('RGB',(W_,TOP+RH*3+20),(236,234,230)); d=ImageDraw.Draw(out)
d.text((20,14),'Epic Batch A acceptance: sketch vs in-engine silhouettes',font=F,fill=(20,20,20))
heads=['Serif sketch (front, 3/4)','Fight camera (black)','Fight ~90 px','Portrait camera (black)','In-engine portrait (lit)']
x=20
for w,hd in zip(CW,heads): d.text((x,56),hd,font=f,fill=(60,60,60)); x+=w+20
for r,(hid,name) in enumerate(heroes):
    y=TOP+r*RH; sk=Image.open(K+hid+'.png').convert('RGB'); sc=sk.width/2400
    cr=sk.crop((0,int(175*sc),int(1180*sc),int(780*sc)))
    tiles=[fit(cr,CW[0],RH-40,(242,241,238)),
           fit(bbox_crop(Image.open(S+'portrait_%s_fight.png'%hid).convert('RGB')),CW[1],RH-40),
           fit(small(Image.open(S+'portrait_%s_fight.png'%hid).convert('RGB')),CW[2],RH-40),
           fit(bbox_crop(Image.open(S+'portrait_%s_portrait.png'%hid).convert('RGB')),CW[3],RH-40)]
    lit=Image.open(S+'portrait_%s_mid.png'%hid).convert('RGBA'); a=lit.split()[3]; b=a.getbbox(); lit=lit.crop(b)
    tiles.append(fit(lit,CW[4],RH-40,(90,96,104)))
    x=20
    for t in tiles: out.paste(t,(x,y+30)); x+=t.width+20
    d.text((20,y+4),name,font=F,fill=(20,20,20))
out.save('/workspace/batchA/epic_batchA_check.png'); print(out.size)
