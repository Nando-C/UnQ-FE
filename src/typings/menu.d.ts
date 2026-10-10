export interface IMenu {
    _id: string
    name: string
    image: string
    short_description: string
    // Optional: the BE doesn't require one.
    description?: string
    price: number
    available: boolean
    category: string
}

export interface IMenuStore {
    data: IMenu,
}