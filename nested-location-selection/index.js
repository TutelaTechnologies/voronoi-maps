const base = '/voronoi-maps/examples/cloud-provider-regions'
const locations = ['aws', 'azure', 'google'].map(file => {
  return fetch(`${base}/locations/${file}.json`)
    .then(req => req.json())
})

const nests = new Map()

Promise.all(locations).then(arrayOfJSON => {
  const totalJSON = arrayOfJSON.reduce((flat, current) => {
    return flat.concat(current)
  }, [])

  let toBuild = [
    ['status', 'provider', 'name'],
    ['status', 'location', 'provider', 'name'],
    ['location', 'status', 'name'],
    ['location', 'provider', 'name'],
  ]

  for (const order of toBuild) {
    const nest = buildNest(totalJSON, order)
    console.log('created a nest\n', nest)
    nests.set(nest, order)

    const div = document.createElement('div')
    div.className = 'container'
    const htmlRoot = buildNestedCheckboxHTML(nest)

    const button = document.createElement('button')
    button.innerText = 'Render'
    button.addEventListener('click', event => {
      const results = filterBySelected(nest, htmlRoot)
      const pre = document.getElementById('selected')
      pre.innerText = JSON.stringify(results, null, 2)
    })
    const p = document.createElement('p')
    p.innerHTML = `Order: <pre>${order.join(' > ')}</pre>`
    div.appendChild(p)
    div.appendChild(button)
    div.appendChild(htmlRoot)
    document.body.appendChild(div)
  }
})

// build data structure

function buildNest(json, order) {
  console.time('nesting')
  const nest = new Map()
  const missingFields = []

  // {A: a, B: b, ... } with order [A, B, C, D, E] has N - 1 maps:
  // a: { b: { c: { d: { e: [] } } } }

  const containsMap = order.slice() // A B C
  const tail = containsMap.pop() // E
  const lastMapKey = containsMap.pop() // D

  json.forEach(obj => {
    let map = nest
    // check for existance first, else a created branch would be empty
    for (const field of order) {
      if (!(field in obj)) {
        console.log(`warning: "${field}" not in object, skipping`)
        console.dir(obj)
        missingFields.push(obj)
        return // next obj
      }
    }
    containsMap.forEach((nestLevel, index) => {
      const objVal = obj[nestLevel]
      // make new nests as needed all the way down
      if (!map.has(objVal)) {
        map.set(objVal, new Map())
      }
      map = map.get(objVal)
    })
    // add the tail to the last Map()'s Set
    // const list = map.get(obj[lastMapKey]) || new Set()
    // map.set(obj[lastMapKey], list.add(obj[tail]))

    const finalMap = map.get(obj[lastMapKey]) || new Map()
    finalMap.set(obj[tail], obj)
    map.set(obj[lastMapKey], finalMap)
  })
  if (missingFields) {
    console.log('the following objects were missing fields:')
    console.log(missingFields)
  }
  console.timeEnd('nesting')
  return nest
}

// build UI structure

function buildNestedCheckboxHTML(nest, parentPath) {
  const group = document.createElement('ul')
  for (const [name, mapOrSet] of nest.entries()) {
    const [li, label, input] = ['li', 'label', 'input'].map(tag => {
      return document.createElement(tag)
    })
    parentPath = parentPath || []
    input.dataset.path = [...parentPath, name].join(' > ')
    input.type = 'checkbox'
    input.addEventListener('click', event => bubbleNestedCheck(event.target))
    const text = document.createTextNode(name)

    label.appendChild(input)
    label.appendChild(text) // can't use .innerText, it'll put it at the start
    li.appendChild(label)

    if (mapOrSet instanceof Map) {
      parentPath.push(name)
      li.appendChild(buildNestedCheckboxHTML(mapOrSet, parentPath))
      parentPath.pop()
    }
    group.appendChild(li)
  }
  return group
}

// assumption: checkboxes will always be in at least one `ul > li`
// want to avoid expecting `li > label > input` or any fixed order

function bubbleNestedCheck(checkbox, relayedContainer) {
  // this bubbles up not down

  const li = relayedContainer || checkbox.closest('li')
  const ul = li.closest('ul')
  const parentContainer = ul.closest('li')

  // parent is checked when all "siblings" are checked
  if (parentContainer) {
    const parent = parentContainer.querySelector('input')
    let total = 0
    let checked = 0
    let indeterminate = 0
    // gather siblings. can't use querySelectorAll for immediate first children
    for (const el of ul.children) {
      const x = el.querySelector('input')
      if (!x) continue
      total++
      // a checkbox can be `checked == false` but `indeterminate == true`...
      checked += (x.checked && !x.indeterminate) ? 1 : 0
      indeterminate += x.indeterminate ? 1 : 0
    }
    const initialChecked = parent.checked
    const initialIndeterminate = parent.indeterminate
    parent.checked = checked === total
    parent.indeterminate = indeterminate > 0 || (checked > 0 && checked < total)
    if (
      initialChecked !== parent.checked ||
      initialIndeterminate !== parent.indeterminate
    ) {
      bubbleNestedCheck(parent, parentContainer)
    }
  }
  // read as: if not relayed and has children
  if (!relayedContainer) {
    const childrenContainer = li.querySelector('ul')
    if (!childrenContainer) return
    const children = childrenContainer.querySelectorAll('input')
    // this avoids nesting function calls by just doing them all at once
    children.forEach(el => {
      el.checked = checkbox.checked
      el.indeterminate = false
    })
  }
}

function filterBySelected(nest, htmlRoot) {
  const results = []
  const checked = htmlRoot.querySelectorAll('input:checked')
  checked.forEach(el => {
    let curr = nest
    el.dataset.path.split(' > ').forEach(part => {
      curr = curr.get(part)
    })
    if (curr instanceof Map) return
    results.push(curr)
  })
  return results
}
