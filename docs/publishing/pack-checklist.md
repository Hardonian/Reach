# Pack Publishing Checklist

- `reach pack validate <path>` passes
- `reach pack sign <path>` executed
- `reach pack verify-signature <path>` passes
- tests and transcripts included
- compatibility ranges declared
- no nondeterministic API usage
- PR includes pack metadata and index update
