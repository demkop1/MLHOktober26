import sys, time, json, base64
from documents import prepare_input
from graph import graph

path = sys.argv[1]
data = "data:application/pdf;base64," + base64.b64encode(open(path, "rb").read()).decode()
text, image = prepare_input(None, data)
t = time.time()
out = graph.invoke({"text": text, "image": image})
print(json.dumps(out["result"].model_dump(), indent=1, ensure_ascii=False)[:6000])
print("seconds:", time.time() - t)
