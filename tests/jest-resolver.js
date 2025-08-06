// Custom Jest resolver for ESM modules
export default (path, options) => {
  // Use default resolver for most cases
  return options.defaultResolver(path, {
    ...options,
    // Handle .js imports that should resolve to .ts files
    extensions: [...options.extensions, '.ts', '.tsx', '.js', '.jsx'],
  });
};
