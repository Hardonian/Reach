module.exports = {
  register() {
    return {
      analyzers: [
        {
          id: "sample-analyzer",
          category: "performance",
          deterministic: true,
          analyze(_input) {
            return [];
          }
        }
      ]
    };
  }
};
