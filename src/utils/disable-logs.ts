// Disable all console logs in production for security
export const disableConsoleLogs = () => {
  if (typeof window !== 'undefined') {
    // Override all console methods
    console.log = () => {}
    console.warn = () => {}
    console.error = () => {}
    console.info = () => {}
    console.debug = () => {}
    console.trace = () => {}
    console.table = () => {}
    console.group = () => {}
    console.groupEnd = () => {}
    console.groupCollapsed = () => {}
    console.time = () => {}
    console.timeEnd = () => {}
    console.count = () => {}
    console.clear = () => {}
    console.dir = () => {}
    console.dirxml = () => {}
    console.assert = () => {}
  }
}

// Call this to enable logs back (for development)
export const enableConsoleLogs = () => {
  if (typeof window !== 'undefined') {
    // Restore original console methods
    delete (console as any).log
    delete (console as any).warn
    delete (console as any).error
    delete (console as any).info
    delete (console as any).debug
    delete (console as any).trace
    delete (console as any).table
    delete (console as any).group
    delete (console as any).groupEnd
    delete (console as any).groupCollapsed
    delete (console as any).time
    delete (console as any).timeEnd
    delete (console as any).count
    delete (console as any).clear
    delete (console as any).dir
    delete (console as any).dirxml
    delete (console as any).assert
  }
}