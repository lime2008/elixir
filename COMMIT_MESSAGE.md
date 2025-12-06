Optimize resource offline processing and fix download failures

1. Fix resource download failures by handling URLs with query parameters
2. Improve directory creation reliability by using parallel processing instead of nested callbacks
3. Enhance image type support by adding JPEG format
4. Boost download efficiency by implementing parallel resource downloads
5. Fix similar issues in both src/index.ts and src/update/updateManager.ts

This change ensures that static.codemao.cn resources are properly downloaded and stored locally, resolving the resource offline processing failures.