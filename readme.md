[![npm version](https://img.shields.io/npm/v/micro-graphql-react.svg?style=flat)](https://www.npmjs.com/package/micro-graphql-react) [![Build Status](https://travis-ci.com/arackaf/micro-graphql-react.svg?branch=master)](https://travis-ci.com/arackaf/micro-graphql-react) [![codecov](https://codecov.io/gh/arackaf/micro-graphql-react/branch/master/graph/badge.svg)](https://codecov.io/gh/arackaf/micro-graphql-react) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

# micro-graphql-react

A light (3.4K min+gzip) and simple solution for painlessly connecting your React components to a GraphQL endpoint.

Queries are fetched via HTTP GET, so while the client-side caching is in some ways not as robust as Apollo's, you can set up a Service Worker to cache results there; Google's Workbox, or sw-toolbox make this easy.

**Live Demo**

To see a live demo of this library managing GraphQL requests, check out this [Code Sandbox](https://codesandbox.io/s/l2z74x2687)

**A note on cache invalidation**

This library will _not_ add metadata to your queries, and attempt to automatically update your cached entries from mutation results. The reason, quite simply, is because this is a hard problem, and no existing library handles it completely. Rather than try to solve this, you're given some simple primitives which allow you to specify how given mutations should affect cached results. It's slightly more work, but it allows you to tailer your solution to your app's precise needs, and, given the predictable, standard nature of GraphQL results, composes well. Of course you can just turn client-side caching off, and run a network request each time, which, if you have a Service Worker set up, may not be too bad. This is all explained at length below.

For more information on the difficulties of GraphQL caching, see [this explanation](./readme-cache.md)

<!-- TOC -->

- [Creating a client](#creating-a-client)
  - [Client options](#client-options)
- [Running queries and mutations](#running-queries-and-mutations)
  - [Building queries](#building-queries)
  - [Props passed for each query](#props-passed-for-each-query)
  - [Building mutations](#building-mutations)
  - [Props passed for each mutation](#props-passed-for-each-mutation)
- [Query decorator](#query-decorator)
  - [props passed to your component](#props-passed-to-your-component)
  - [Other options](#other-options)
- [Mutation decorator](#mutation-decorator)
  - [props passed to your component](#props-passed-to-your-component-1)
  - [Other options](#other-options-1)
- [Caching](#caching)
  - [Cache object](#cache-object)
    - [Cache api](#cache-api)
  - [Cache invalidation](#cache-invalidation)
    - [Use Case 1: Hard reset and reload after any mutation](#use-case-1-hard-reset-and-reload-after-any-mutation)
    - [Use Case 2: Update current results, but otherwise clear the cache](#use-case-2-update-current-results-but-otherwise-clear-the-cache)
    - [Use Case 3: Manually update all affected cache entries](#use-case-3-manually-update-all-affected-cache-entries)
- [Manually running queries or mutations](#manually-running-queries-or-mutations)
  - [Client api](#client-api)
- [Transpiling decorators](#transpiling-decorators)
  - [But I don't like decorators](#but-i-dont-like-decorators)
- [Use in old browsers](#use-in-old-browsers)

<!-- /TOC -->

## Creating a client

Before you do anything, you'll need to create a client.

```javascript
import { Client, setDefaultClient } from "micro-graphql-react";

const client = new Client({
  endpoint: "/graphql",
  fetchOptions: { credentials: "include" }
});

setDefaultClient(client);
```

Now that client will be used by default, everywhere, unless you manually pass in a different client to a component's options, as discussed below.

### Client options

<!-- prettier-ignore -->
| Option  | Description |
| -------| ----------- |
| `endpoint` | URL for your GraphQL endpoint |
| `fetchOptions`  | Options to send along with all fetches|
| `cacheSize`  | Default cache size to use for all caches created by this client, as needed, for all queries it processes|
| `noCaching`  | If true, this will turn off caching altogether for all queries it processes|

## Running queries and mutations

The most flexible way of running GraphQL operations is with the `GraphQL` component.

```javascript
import { GraphQL, buildQuery, buildMutation } from "micro-graphql-react";

<GraphQL
  query={{
    loadBooks: buildQuery(LOAD_BOOKS, { title: this.state.titleSearch }, { onMutation: hardResetStrategy("Book") })
  }}
  mutation={{ updateBook: buildMutation(UPDATE_BOOK) }}
>
  {({ loadBooks: { loading, loaded, data, error }, updateBook: { runMutation } }) => (
    <div>
      {loading ? <span>Loading...</span> : null}
      {loaded && data && data.allBooks ? <DisplayBooks books={data.allBooks.Books} editBook={this.editBook} /> : null}
      <br />
      {this.state.editingBook ? <UpdateBook book={this.state.editingBook} updateBook={runMutation} /> : null}
    </div>
  )}
</GraphQL>;
```

### Building queries

Construct each query with the `buildQuery` method. The first argument is the query text itself. The second, optional argument, is the query's variables. You can also pass a third options argument, which can contain any of the following properties:

<!-- prettier-ignore -->
| Option  | Description |
| -------| ----------- |
| `onMutation` | A map of mutations, along with handlers. This is how you update your cached results after mutations, and is explained more fully below |
| `client`  | Manually pass in a client to be used for this query, which will override the default client|
| `cache`  | Manually pass in a cache object to be used for this query|

Be sure to use the `compress` tag to remove un-needed whitespace from your query text, since it will be sent via HTTP GET—for more information, see [here](./readme-compress.md).

An even better option would be to use my [persisted queries helper](https://github.com/arackaf/generic-persistgraphql). This not only removes the entire query text from your nextwork requests altogether, but also from our bundled code.

### Props passed for each query

For each query you specify, an object will be passed in the component's props by that same name, with the following properties.

<!-- prettier-ignore -->
| Props | Description |
| ----- | ----------- |
|`loading`|Fetch is executing for your query|
|`loaded`|Fetch has finished executing for your query|
|`data`|If the last fetch finished successfully, this will contain the data returned, else null|
|`error`|If the last fetch did not finish successfully, this will contain the errors that were returned, else `null`|
|`reload`|A function you can call to manually re-fetch the current query|
|`clearCache`|Clear the cache for this component|
|`clearCacheAndReload`|Calls `clearCache`, followed by `reload`|

### Building mutations

Construct each mutation with the `buildMutation` method. The first argument is the mutation text. The second, optional options argument can accept only a `client` property, which will override the client default, same as with queries.

### Props passed for each mutation

For each mutation you specify, an object will be passed in the component's props by that same name, with the following properties.

<!-- prettier-ignore -->
| Props         | Description  |
| ------------- | --------- |
| `running`     | Mutation is executing |
| `finished`    | Mutation has finished executing|
| `runMutation` | A function you can call when you want to run your mutation. Pass it an object with your variables |

## Query decorator

The `query` decorator is not as flexible as the GraphQL component, but it can be ideal for less complex use cases.

```javascript
import { query } from "micro-graphql-react";

@query(LOAD_BOOKS, props => ({ page: props.page }))
export default class BasicQuery extends Component {
  render() {
    let { loading, loaded, data } = this.props;
    let booksArr = data ? data.allBooks.Books : [];
    return (
      <div>
        {loading ? <div>LOADING</div> : null}
        {loaded ? <div>LOADED</div> : null}
        {data ? (
          <ul>
            {booksArr.map(b => (
              <li key={b._id}>{b.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

The `query` decorator is passed the GraphQL query, and an optional function mapping the component's props to a variables object. When the component first mounts, this query will be executed. When the component updates, the variables function will re-run with the new props, and the query will re-fetch **if** the newly-created GraphQL query is different. Of course if your query has no variables, it'll never update.

### props passed to your component

<!-- prettier-ignore -->
| Props | Description |
| ----- | ----------- |
|`loading`|Fetch is executing for your query|
|`loaded`|Fetch has finished executing for your query|
|`data`|If the last fetch finished successfully, this will contain the data returned, else null|
|`error`|If the last fetch did not finish successfully, this will contain the errors that were returned, else `null`|
|`reload`|A function you can call to manually re-fetch the current query|
|`clearCache`|Clear the cache for this component|
|`clearCacheAndReload`|Calls `clearCache`, followed by `reload`|

### Other options

The decorator can also take a third argument of options (or second argument, if your query doesn't use variables). The following properties can be passed in this object:

<!-- prettier-ignore -->
| Option  | Description |
| -------| ----------- |
| `onMutation` | A map of mutations, along with handlers. This is how you update your cached results after mutations, and is explained more fully below |
| `mapProps`| Allows you to adjust the props passed to your component. If specified, a single object with all your GraphQL props will be passed to this function, and the result will be spread into your component's props |
| `client`  | Manually pass in a client to be used for this component|
| `cache`  | Manually pass in a cache object to be used for this component|

An example of `mapProps`

```javascript
@query(LOAD_BOOKS_FIRST, props => ({ title_contains: props.title_contains }), { mapProps: props => ({ firstBookProps: props }) })
@query(LOAD_BOOKS_SECOND, props => ({ title_contains: props.title_contains }), { mapProps: props => ({ lastBookProps: props }) })
class TwoQueries extends Component {
  render() {
    let { firstBookProps, lastBookProps } = this.props;
    return (
      <div>
        {firstBookProps.loading || lastBookProps.loading ? <div>LOADING</div> : null}
        {firstBookProps.loaded || lastBookProps.loaded ? <div>LOADED</div> : null}
        {firstBookProps.data ? (
          <ul>
            {firstBookProps.data.allBooks.Books.map(book => (
              <li key={book._id}>{book.title}</li>
            ))}
          </ul>
        ) : null}
        {lastBookProps.data ? (
          <ul>
            {lastBookProps.data.allBooks.Books.map(book => (
              <li key={book._id}>{book.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

## Mutation decorator

```javascript
import { query } from "micro-graphql-react";

@mutation(MODIFY_BOOK)
class BasicMutation extends Component {
  render() {
    let { running, finished, runMutation } = this.props;
    return (
      <div>
        {running ? <div>RUNNING</div> : null}
        {finished ? <div>SAVED</div> : null}

        <input ref={el => (this.el = el)} placeholder="New title here!" />
        <button onClick={() => runMutation({ title: this.el.value })}>Save</button>
      </div>
    );
  }
}
```

Same idea as `query`, pass a string for your mutation and you'll get a `runMutation` function in your props that you can call, and pass your variables.

### props passed to your component

<!-- prettier-ignore -->
| Props         | Description  |
| ------------- | --------- |
| `running`     | Mutation is executing |
| `finished`    | Mutation has finished executing|
| `runMutation` | A function you can call when you want to run your mutation. Pass it an object with your variables |

### Other options

Like `query`, you can pass a second argument to your `mutation` decorator. Here, this object only supports the `mapProps`, and `client` options, which work the same as for queries.

```javascript
@query(LOAD_BOOKS, props => ({ page: props.page }))
@mutation(MODIFY_BOOK_TITLE, { mapProps: props => ({ titleMutation: props }) })
@mutation(MODIFY_BOOK_PAGES, { mapProps: props => ({ pagesMutation: props }) })
class TwoMutationsAndQuery extends Component {
  state = { editingId: "", editingOriginaltitle: "" };
  edit = book => {
    this.setState({ editingId: book._id, editingOriginaltitle: book.title, editingOriginalpages: book.pages });
  };
  render() {
    let { loading, loaded, data, titleMutation, pagesMutation } = this.props;

    let { editingId, editingOriginaltitle, editingOriginalpages } = this.state;
    return (
      <div>
        {loading ? <div>LOADING</div> : null}
        {loaded ? <div>LOADED</div> : null}
        {data ? (
          <ul>
            {data.allBooks.Books.map(book => (
              <li key={book._id}>
                {book.title}
                <button onClick={() => this.edit(book)}> edit</button>
              </li>
            ))}
          </ul>
        ) : null}

        {editingId ? (
          <Fragment>
            {titleMutation.running ? <div>RUNNING</div> : null}
            {titleMutation.finished ? <div>SAVED</div> : null}
            <input defaultValue={editingOriginaltitle} ref={el => (this.el = el)} placeholder="New title here!" />
            <button onClick={() => titleMutation.runMutation({ _id: editingId, title: this.el.value })}>Save</button>

            {pagesMutation.running ? <div>RUNNING</div> : null}
            {pagesMutation.finished ? <div>SAVED</div> : null}
            <input defaultValue={editingOriginalpages} ref={el => (this.elPages = el)} placeholder="New pages here!" />
            <button onClick={() => pagesMutation.runMutation({ _id: editingId, pages: +this.elPages.value })}>Save</button>
          </Fragment>
        ) : null}
      </div>
    );
  }
}
```

## Caching

The client object maintains a cache of each query it comes across when processing your components. The cache is LRU with a default size of 10 and, again, stored at the level of each specific query, not the GraphQL type. As your instances mount and unmount, and update, the cache will be checked for existing results to matching queries.

### Cache object

You can import the `Cache` class like this

```javascript
import { Cache } from "micro-graphql-react";
```

When instantiating a new cache object, you can optionally pass in a cache size.

```javascript
let cache = new Cache(15);
```

To turn caching off for a given query, just create a cache with size `0`, and pass that in for the query. Or as noted above, you can create a client with the `noCaching` option set to true, to turn caching off for all queries processed by that client.

#### Cache api

The cache object has the following properties and methods

<!-- prettier-ignore -->
| Member | Description  |
| ----- | --------- |
| `get entries()`   | An array of the current entries. Each entry is an array of length 2, of the form `[key, value]`. The cache entry key is the actual GraphQL url query that was run. If you'd like to inspect it, see the variables that were sent, etc, just use your favorite url parsing utility, like `url-parse`. And of course the cache value itself is whatever the server sent back for that query. If the query is still pending, then the entry will be a promise for that request. |
| `get(key)` | Gets the cache entry for a particular key      |
| `set(key, value)` | Sets the cache entry for a particular key  |
| `delete(key)`     | Deletes the cache entry for a particular key |
| `clearCache()`    | Clears all entries from the cache |

### Cache invalidation

The onMutation option that query options take is an object, or array of objects, of the form `{ when: string|regularExpression, run: function }`

`when` is a string or regular expression that's tested against each result of any mutations that finish. If the mutation has any matches, then `run` will be called with three arguments: an object with these propertes, described below, `{ softReset, currentResults, hardReset, cache, refresh }`; the entire mutation result; and the mutation's variables object.

<!-- prettier-ignore -->
| Arg  | Description  |
| ---| -------- |
| `softReset` | Clears the cache, but does **not** re-issue any queries. It can optionally take an argument of new, updated results, which will replace the current `data` props |
| `currentResults` | The current results that are passed as your `data` prop |
| `hardReset` | Clears the cache, and re-load the current query from the network|
| `cache`  | The actual cache object. You can enumerate its entries, and update whatever you need.|
| `refresh`   | Refreshes the current query, from cache if present. You'll likely want to call this after modifying the cache.  |

Many use cases follow. They're based on an hypothetical book tracking website since, if we're honest, the Todo example has been stretched to its limit—and also I built a book tracking website and so already have some data to work with :D

The code below was tested on an actual GraphQL endpoint created by my [mongo-graphql-starter project](https://github.com/arackaf/mongo-graphql-starter)

All examples use the `query` decorator, but the format is identical to the `GraphQL` component.

#### Use Case 1: Hard reset and reload after any mutation

Let's say that whenever a mutation happens, we want to immediately invalidate any related queries' caches, and reload the current queries from the network. We understand that this may cause a book that we just edited to immediately disappear from our current search results, since it no longer matches our search criteria, but that's what we want.

The hard reload method that's passed makes this easy. Let's see how to use this in a (contrived) component that queries, and displays some books.

```javascript
@query(BOOKS_QUERY, props => ({ page: props.page }), {
  onMutation: { when: /(update|create|delete)Books?/, run: ({ hardReset }) => hardReset() }
})
export class BookQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allBooks.Books.map(b => (
              <li key={b._id}>{b.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

Here we specify a regex matching every kind of book mutation we have, and upon completion, we just clear the cache, and reload by calling `hardReset()`. It's hard not to be at least a littler dissatisfied with this solution; the boilerplate is non-trivial. Let's take a look at a similar (again contrived) component, but for the subjects we can apply to books

```javascript
@query(SUBJECTS_QUERY, props => ({ page: props.page }), {
  onMutation: { when: /(update|create|delete)Subjects?/, run: ({ hardReset }) => hardReset() }
})
export class SubjectQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allSubjects.Subjects.map(s => (
              <li key={s._id}>{s.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

Assuming our GraphQL operations have a consistent naming structure—and they should—then some pretty obvious patterns emerge. We can auto-generate this structure just from the name of our type, like so

```javascript
const hardResetStrategy = name => ({
  when: new RegExp(`(update|create|delete)${name}s?`),
  run: ({ hardReset }) => hardReset()
});
```

and then apply it like so

```javascript
@query(BOOKS_QUERY, props => ({ page: props.page }), { onMutation: hardResetStrategy("Book") })
export class BookQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allBooks.Books.map(b => (
              <li key={b._id}>{b.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}

@query(SUBJECTS_QUERY, props => ({ page: props.page }), { onMutation: hardResetStrategy("Subject") })
export class SubjectQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allSubjects.Subjects.map(s => (
              <li key={s._id}>{s.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

#### Use Case 2: Update current results, but otherwise clear the cache

Let's say that, upon successful mutation, you want to update your current results based on what was changed, clear all other cache entries, including the existing one, but **not** run any network requests. So if you're currently searching for an author of "Dumas Malone," but one of the current results was clearly written by Shelby Foote, and you click the book's edit button and fix it, you want that book to now show the updated values, but stay in the current results, since re-loading the current query and having the book just vanish is bad UX in your opinion.

Here's the same books component as above, but with our new cache strategy

```javascript
@query(BOOKS_QUERY, props => ({ page: props.page }), {
  onMutation: {
    when: "updateBook",
    run: ({ softReset, currentResults }, { updateBook: { Book } }) => {
      let CachedBook = currentResults.allBooks.Books.find(b => b._id == Book._id);
      CachedBook && Object.assign(CachedBook, Book);
      softReset(currentResults);
    }
  }
})
export class BookQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allBooks.Books.map(b => (
              <li key={b._id}>{b.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

Whenever a mutation comes back with `updateBook` results, we use `softReset` to update our current results, while clearing our cache, including the current cache result; so if you page up, then come back down to where you were, a **new** network request will be run, and your edited book will no longer be there, as expected. Note that in this example we're actually mutating our current cache result; that's fine.

This seems like a lot of boilerplate, but again, lets look at the subjects component and see if any patterns emerge.

```javascript
@query(SUBJECTS_QUERY, props => ({ page: props.page }), {
  onMutation: {
    when: "updateSubject",
    run: ({ softReset, currentResults }, { updateSubject: { Subject } }) => {
      let CachedSubject = currentResults.allSubjects.Subjects.find(s => s._id == Subject._id);
      CachedSubject && Object.assign(CachedSubject, Subject);
      softReset(currentResults);
    }
  }
})
export class SubjectQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allSubjects.Subjects.map(s => (
              <li key={s._id}>{s.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

As before, since we've named our GraphQL operations consistently, there's some pretty obvious repetition. Let's again refactor this into a helper method that can be re-used throughout our app.

```javascript
const standardUpdateSingleStrategy = name => ({
  when: `update${name}`,
  run: ({ softReset, currentResults }, { [`update${name}`]: { [name]: updatedItem } }) => {
    let CachedItem = currentResults[`all${name}s`][`${name}s`].find(x => x._id == updatedItem._id);
    CachedItem && Object.assign(CachedItem, updatedItem);
    softReset(currentResults);
  }
});
```

Now we can clean up all that boilerplate from before

```javascript
@query(BOOKS_QUERY, props => ({ page: props.page }), { onMutation: standardUpdateSingleStrategy("Book") })
export class BookQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allBooks.Books.map(b => (
              <li key={b._id}>{b.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}

@query(SUBJECTS_QUERY, props => ({ page: props.page }), { onMutation: standardUpdateSingleStrategy("Subject") })
export class SubjectQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allSubjects.Subjects.map(s => (
              <li key={s._id}>{s.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

And if you have multiple mutations, just pass them in an array

#### Use Case 3: Manually update all affected cache entries

Let's say you want to intercept mutation results, and manually update your cache. This is difficult to get right, so be careful.

There's a `cache` object passed to the `run` callback, with an `entries` property you can iterate, and update. As before, it's fine to just mutate the cached entries directly; just don't forget to call the `refresh` method when done, so your current results will update.

This example shows how you can remove a deleted book from every cache result.

```javascript
@query(BOOKS_QUERY, props => ({ page: props.page }), {
  onMutation: {
    when: "deleteBook",
    run: ({ cache, refresh }, mutationResponse, args) => {
      cache.entries.forEach(([key, results]) => {
        results.data.allBooks.Books = results.data.allBooks.Books.filter(b => b._id != args._id);
      });
      refresh();
    }
  }
})
export class BookQueryComponent extends Component {
  render() {
    let { data } = this.props;
    return (
      <div>
        {data ? (
          <ul>
            {data.allBooks.Books.map(book => (
              <li key={book._id}>{book.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
```

It's worth noting that this solution will have problems if your results are paged. Any non-active entries should really be purged and re-loaded when next needed, so a full, correct page of results will come back.

## Manually running queries or mutations

It's entirely possible some pieces of data may need to be loaded from, and stored in your state manager, rather than fetched via a component's lifecycle; this is easily accomodated. The `GraphQL` component, and component decorators run their queries and mutations through the client object you're already setting via `setDefaultClient`. You can call those methods yourself, in your state manager (or anywhere).

### Client api

- `runQuery(query: String, variables?: Object)`
- `runMutation(mutation: String, variables?: Object)`

For example, to imperatively run the query from above in application code, you can do

```javascript
client.runQuery(
  compress`query ALL_BOOKS ($page: Int) {
    allBooks(PAGE: $page, PAGE_SIZE: 3) {
      Books { _id title }
    }
  }`,
  { title: 1 }
);
```

and to run the mutation from above, you can do

```javascript
client.runMutation(
  `mutation modifyBook($title: String) {
    updateBook(_id: "591a83af2361e40c542f12ab", Updates: { title: $title }) {
      Book { _id title }
    }
  }`,
  { title: "New title" }
);
```

## Transpiling decorators

Be sure to use the `babel-plugin-transform-decorators-legacy` Babel plugin. When the new decorators proposal is updated, this code will be updated to support both.

### But I don't like decorators

That's fine! This will work too

```javascript
class BasicQueryNoDecorators extends Component {
  render() {
    let { loading, loaded, data } = this.props;
    return (
      <div>
        {loading ? <div>LOADING</div> : null}
        {loaded ? <div>LOADED</div> : null}
        {data ? (
          <ul>
            {data.allBooks.Books.map(book => (
              <li key={book._id}>{book.title}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
}
const BasicQueryConnected = query(
  compress`
    query ALL_BOOKS($page: Int) {
      allBooks(PAGE: $page, PAGE_SIZE: 3) {
        Books {
          _id
          title
        }
      }
    }`,
  props => ({ page: props.page })
)(BasicQueryNoDecorators);
```

Again, I plan on supporting both the old, and new class decorator formats indefinitely, if for no other reason than to transparently allow for separate, explicit wrapping like the above. This pattern is popular for unit testing React components.

But really, don't be afraid to give decorators a try: they're awesome!

## Use in old browsers

By default this library ships modern, standard JavaScript, which should work in all decent browsers. If you have to support older browsers like IE, then just add the following alias to your webpack's resolve section

```javascript
  resolve: {
    alias: {
      "micro-graphql-react": "node_modules/micro-graphql-react/index-es5.js"
    },
    modules: [path.resolve("./"), path.resolve("./node_modules")]
  }
```
