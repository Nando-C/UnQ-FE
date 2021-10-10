import { useEffect } from "react"
import { ListGroup } from "react-bootstrap"
import { useDispatch } from "react-redux"
import { useParams } from "react-router"
import { useAppSelector } from "../../../redux/app/hooks"
import { getTableCart, selectCartsData } from "../../../redux/slices/cartSlice"
import CartItem from "../CartItem/CartItem"
import "./CartListItems.css"

const CartListItems = () => {
    const params = useParams<{ tableId: string }>()
    const tableId  = params.tableId

    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(getTableCart(tableId))
    }, [])
    const cart = useAppSelector(selectCartsData)

    return (
        <>
        <ListGroup className="px-0" variant="flush">
                {cart.items.map(item => (
                    <ListGroup.Item key={item._id} className="px-0 menu-item">
                        <CartItem cartId={cart._id} itemId={item._id} />
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </>
    )
}

export default CartListItems