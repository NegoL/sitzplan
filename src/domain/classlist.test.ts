import { expect, it } from 'vitest'
import { parseClassList, parseNames } from './classlist'

it('finds each class with its students', () => {
  const pages = [
    ['Gymnasium Musterstadt', 'Klasse 5a', 'Nachname, Vorname', 'Arslan, Elif', 'Becker, Jonas', 'Seite 1 von 3'],
    ['Gymnasium Musterstadt', 'Klasse 5b', 'Nachname, Vorname', 'Çelik, Deniz', 'Seite 2 von 3'],
  ]
  expect(parseClassList(pages)).toEqual([
    { label: '5a', students: [{ last: 'Arslan', first: 'Elif' }, { last: 'Becker', first: 'Jonas' }] },
    { label: '5b', students: [{ last: 'Çelik', first: 'Deniz' }] },
  ])
})

it('follows a class onto the next page, with or without the heading repeated', () => {
  const pages = [
    ['7b', 'Albrecht, Mia'],
    ['Baumann, Noah'],
    ['7b', 'Conrad, Lea'],
    ['7c', 'Demir, Can'],
  ]
  expect(parseClassList(pages)).toEqual([
    { label: '7b', students: [{ last: 'Albrecht', first: 'Mia' }, { last: 'Baumann', first: 'Noah' }, { last: 'Conrad', first: 'Lea' }] },
    { label: '7c', students: [{ last: 'Demir', first: 'Can' }] },
  ])
})

it('keeps only the name from lines with numbering and further columns', () => {
  const pages = [['Klasse: 10 B', '1. von der Heide, Anna-Lena\t12.03.2010\tMusterweg 3', '2 Öztürk, Ali Can  w  ev', "3\tO'Brien, Seán"]]
  expect(parseClassList(pages)[0]).toEqual({
    label: '10 B',
    students: [
      { last: 'von der Heide', first: 'Anna-Lena' },
      { last: 'Öztürk', first: 'Ali Can' },
      { last: "O'Brien", first: 'Seán' },
    ],
  })
})

it('reads upper-school year groups as classes', () => {
  const pages = [['EF', 'Ernst, Tom'], ['Q1', 'Franke, Ida']]
  expect(parseClassList(pages).map((c) => c.label)).toEqual(['EF', 'Q1'])
})

it('ignores names that appear before any class heading', () => {
  expect(parseClassList([['Müller, Schulleiter', 'Klasse 6a', 'Gross, Ben']])).toEqual([
    { label: '6a', students: [{ last: 'Gross', first: 'Ben' }] },
  ])
})

it('reads a pasted list in either name order', () => {
  expect(parseNames('Arslan, Elif\n\n  Jonas Becker \nAnna Lena von Stein\nCher')).toEqual([
    { last: 'Arslan', first: 'Elif' },
    { last: 'Becker', first: 'Jonas' },
    { last: 'von Stein', first: 'Anna Lena' },
    { last: '', first: 'Cher' },
  ])
})
