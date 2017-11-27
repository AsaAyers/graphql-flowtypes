export type Foo = {
  foo: string,
}

export type Bar = {
  foo: Foo,
  bar?: ?number
}

export type FooBar = {
  foo?: ?Foo,
  bar?: ?Bar
}

export type Baz = {
  baz: string,
}
