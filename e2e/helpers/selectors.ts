// ロケータ方針のヘルパ（必要に応じて拡張）
export const by = {
  heading: (name: RegExp | string, level?: number) => ({ name, level }),
};

