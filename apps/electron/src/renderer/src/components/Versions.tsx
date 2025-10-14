import { useMemo } from 'react'

function Versions(): React.JSX.Element {
  const versions = useMemo(() => {
    const electronProcess = window.electron?.process
    return electronProcess?.versions ?? process.versions
  }, [])

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions
