import { Container } from "react-bootstrap"
import CartListItems from "../CartListItems/CartListItems"
import "./Cart.css"

const Cart = () => {

    return (
        <>
            <Container>
                <CartListItems />
            </Container>
        </>
    )
}

export default Cart