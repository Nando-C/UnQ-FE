import { useEffect } from "react"
import { Card, Container } from "react-bootstrap"
import { useParams } from "react-router"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { getMyOpenCart, getTableCart, selectCartPointers, selectCartsData } from "../../../redux/slices/cartSlice"
import CartListItems from "../CartListItems/CartListItems"
import "./Cart.css"

const Cart = () => {

    const dispatch = useAppDispatch()
    const { shopId, tableId } = useAppSelector(selectCartPointers)

    useEffect(()=> {
        // dispatch(getMyOpenCart())
        dispatch(getTableCart(tableId))
    }, [])

    const cart = useAppSelector(selectCartsData)
    console.log(cart)
    
    
    return (
        <>
            <Container>
                { cart.items.length > 0  
                    ? <CartListItems />
                    : 
                    <Card>
                        <Card.Body>
                    <Card.Title>
                        Looks like you don't have any open orders!!
                    </Card.Title>
                    </Card.Body>
                </Card>
                }
            </Container>
        </>
    )
}

export default Cart