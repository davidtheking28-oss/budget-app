def rd(f):
    s=open(f,encoding='utf-8',newline='').read();nl='\r\n' if '\r\n' in s else '\n';return s.replace('\r\n','\n'),nl
def wr(f,s,nl):
    open(f,'w',encoding='utf-8',newline='').write(s.replace('\n',nl))
def sub(f,a,b):
    s,nl=rd(f);assert a in s,(f,a);wr(f,s.replace(a,b,1),nl)
def app(f,t):
    s,nl=rd(f);wr(f,s.rstrip('\n')+'\n\n'+t.strip('\n')+'\n',nl)
