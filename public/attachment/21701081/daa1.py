import random
n=int(input("Enter a number:"))
l=[]
while len(l)<n:
    i=random.randint(0,1000)
    if(i not in l):
      l.append(i)
print(l)
