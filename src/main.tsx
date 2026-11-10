import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { loadState } from './store'
import './style.css'
import { ClassView } from './ui/ClassView'
import { Home } from './ui/Home'
import { ImportView } from './ui/ImportView'
import { useRoute } from './ui/parts'
import { PlanView } from './ui/PlanView'
import { RoomEditor } from './ui/RoomEditor'
import { RuleEditor } from './ui/RuleEditor'

function App() {
  const [area, id, sub, subId] = useRoute()
  if (area === 'klasse' && id && sub === 'import') return <ImportView id={id} />
  if (area === 'klasse' && id && sub === 'regel' && subId) return <RuleEditor key={subId} classId={id} ruleId={subId} />
  if (area === 'klasse' && id) return <ClassView key={id} id={id} />
  if (area === 'raum' && id) return <RoomEditor id={id} />
  if (area === 'plan' && id) return <PlanView key={id} id={id} />
  return <Home />
}

registerSW({ immediate: true })
loadState()
  .catch((e) => alert(`Die gespeicherten Daten ließen sich nicht laden: ${e}`))
  .then(() => render(<App />, document.getElementById('app')!))
