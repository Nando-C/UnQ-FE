import { useEffect, useState } from "react"
import { Card, Col, Row, Button, Image } from "react-bootstrap"
import { useParams } from "react-router"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { addToCart, removeFromCart, selectCartsData } from "../../../redux/slices/cartSlice"
import { IItem } from "../../../typings/cart"
import { IMenu } from "../../../typings/menu"
import "./CartItem.css"

interface CartItemProps {
    cartId: string
    itemId: string | undefined
}

const CartItem = ({cartId, itemId}: CartItemProps) => {
    const params = useParams<{ shopId: string, tableId: string }>()
    const shopId  = params.shopId
    const tableId  = params.tableId

    const cartItem = useAppSelector(state => state.carts.data.items.find(item => item._id === itemId))
    // console.log(item)

    const [item, setItem] = useState<IItem | undefined>({
        _id: "",
        menuId: null,
        qty: 1
    })

    useEffect(() => {
        setItem(cartItem)
    }, [cartItem])

    const dispatch = useAppDispatch()

    const increment = () => {
        const plusItem = {
            menuId: item!.menuId,
            qty: 1
        }

       dispatch(addToCart({
        shopId: shopId,
        tableId: tableId,
        item: plusItem
       }))
    }

    const decrement = () => {
      const minusItem = {
            menuId: item!.menuId,
            qty: 1
        }
        
       dispatch(removeFromCart({
        shopId: shopId,
        tableId: tableId,
        item: minusItem
       }))
    }

    return(
        <>
            <Card className="MenuItem">
                <Row>
                    <Col className="image-col ps-0" xs={4}>
                        <Image src={item?.menuId?.image} rounded fluid />
                        <div className="image-overlayer"></div>
                    </Col>
                    <Col xs={8} className="text-start d-flex flex-column justify-content-between pe-2">
                        <Row className="mt-2">
                            <Col>
                                <Card.Subtitle className="ms-3">
                                    {item?.menuId?.name}
                                </Card.Subtitle>
                                <Card.Body className="ms-3 p-0">
                                    <small>{item?.menuId?.short_description}</small>
                                </Card.Body>
                            </Col>
                        </Row>
                        <Row className="pb-2 align-items-center">
                            <Col xs={5}>
                                <Card.Body className="p-0 ms-3">
                                    <small><strong>£ {item?.menuId?.price}</strong></small>
                                </Card.Body>
                            </Col>
                            <Col xs={5}>
                                <Row className="text-center align-items-center">
                                    <Col className="px-0">
                                        <Button size="sm" onClick={increment} ><strong>+</strong></Button>
                                    </Col>
                                    <Col className="px-0">
                                        <Card.Body className="p-0">
                                            <small>{item?.qty}</small>
                                        </Card.Body>
                                    </Col>
                                    <Col className="px-0">
                                        <Button size="sm" onClick={decrement} ><strong>-</strong></Button>
                                    </Col>
                                </Row>
                            </Col>
                            <Col xs={2}></Col>
                        </Row>
                    </Col>
                </Row>
            </Card>
        </>
    )
}

export default CartItem