import { ReactElement, ReactNode } from "react"
import { combineReducers, configureStore } from "@reduxjs/toolkit"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import userReducer from "../redux/slices/userSlice"
import shopReducer from "../redux/slices/shopSlice"
import browseReducer from "../redux/slices/browseSlice"
import cartReducer from "../redux/slices/cartSlice"
import type { RootState } from "../redux/app/store"

// A single combined reducer lets configureStore accept a partial preloadedState
// (the map-object form rejects it under strict types).
const rootReducer = combineReducers({
  user: userReducer,
  shops: shopReducer,
  browse: browseReducer,
  carts: cartReducer,
})

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof makeStore>

interface RenderOptions {
  preloadedState?: Partial<RootState>
  store?: AppStore
  // Initial URL. Combine with `path` when the component reads route params.
  route?: string
  // A react-router path pattern (e.g. "/shops/:shopId/tables/:tableId/cart")
  // used to extract useParams(); omit for components that don't need params.
  path?: string
}

// Renders `ui` with real reducers inside a MemoryRouter, returning the store
// and a userEvent instance alongside RTL's usual queries.
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = makeStore(preloadedState),
    route = "/",
    path,
  }: RenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </Provider>
    )
  }

  return {
    store,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper }),
  }
}

// Holds a request until the test lets it through.
export const gate = () => {
  let open!: () => void
  const opened = new Promise<void>((r) => (open = r))
  return { open, opened }
}
