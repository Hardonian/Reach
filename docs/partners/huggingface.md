# Hugging Face Integration

## Overview

Reach integrates with Hugging Face to allow execution of open-source models hosted on Inference Endpoints.

## Configuration

Set your HF token in the environment:

```bash
export HF_TOKEN=hf_...
```

## Usage

In your pack config:
`provider: "huggingface"`
`model: "meta-llama/Llama-2-70b-chat-hf"`
