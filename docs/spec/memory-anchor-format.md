# Memory Anchor Format

```json
{
  "version": "1",
  "items": [
    {
      "memory_id": "string",
      "type": "prompt|tool|observation|summary|retrieval",
      "role": "optional string",
      "content": "optional string",
      "content_ref": "optional hash/ref",
      "tool_call": {"optional": "structured object"},
      "attachments": ["optional attachment hash refs"],
      "metadata": {"optional": "deterministic string map"}
    }
  ]
}
```

Canonicalization uses deterministic JSON key ordering; list ordering is preserved and hash-significant.
