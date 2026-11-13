import json
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler

MODEL = "Qwen/Qwen3-1.7B"
GREEDY = make_sampler(temp=0.0)

def load_model(adapter=None):
    return load(MODEL, adapter_path=adapter)

def ask(model, tok, question, max_tokens=80):
    prompt = tok.apply_chat_template([{"role": "user", "content": question}],
                                     add_generation_prompt=True, enable_thinking=False, tokenize=False)
    return generate(model, tok, prompt, max_tokens=max_tokens, sampler=GREEDY).strip()

def hit(answer, keywords):
    a = answer.lower()
    return any(k in a for k in keywords)
