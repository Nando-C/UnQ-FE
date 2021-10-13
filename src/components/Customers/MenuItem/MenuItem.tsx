import { useEffect, useState } from "react"
import { Card, Col, Image, Row, Button } from "react-bootstrap"
import { useDispatch } from "react-redux"
import { useParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { addToCart } from "../../../redux/slices/cartSlice"
import { fetchMenuItem, fetchSingleShop, selectSelectedMenu, selectSelectedShop } from "../../../redux/slices/shopSlice"
import { IItem } from "../../../typings/cart"
import "./MenuItem.css"

interface MenuItemProps {
    itemId: string 
    shopId: string
}

const MenuItem = ({shopId, itemId}: MenuItemProps) => {
    const params = useParams<{ tableId: string }>()
    const tableId  = params.tableId

    const [item, setItem] = useState<IItem>({
        menuId: null,
        qty: 1
    })

    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(fetchSingleShop(shopId))
    }, [])

    const shop = useAppSelector(selectSelectedShop)
    const menuItem = shop?.menu.find(item => item._id === itemId)

    useEffect(() => {
        setItem({...item, menuId: menuItem})
    }, [menuItem])

    const increment = () => {
        const newQty = item.qty + 1
        setItem({...item, qty: newQty})
    }

    const decrement = () => {
        const newQty = item.qty - 1
        if (newQty >= 0) {
            setItem({...item, qty: newQty})
        } else {
            setItem({...item, qty: 0})
        }
    }
    
    const addItemToCart = async () => {
        dispatch(addToCart({
            shopId: shopId,
            tableId: tableId,
            item: item
        }))
    }

    return(
        <>
         <Card className="MenuItem">
             <Row>
                 <Col xs={8} className="text-start d-flex flex-column justify-content-between pe-2">
                    <Row className="mt-2">
                        <Col>
                            <Card.Subtitle className="ms-3">
                                {menuItem?.name}
                            </Card.Subtitle>
                            <Card.Body className="ms-3 p-0">
                                <small>{menuItem?.short_description}</small>
                            </Card.Body>
                        </Col>
                    </Row>
                    <Row className="pb-2 align-items-center">
                        <Col xs={5}>
                            <Card.Body className="p-0 ms-3">
                            <small><strong>£ {menuItem?.price}</strong></small>
                            </Card.Body>
                        </Col>
                        <Col xs={5}>
                            <Row className="text-center align-items-center">
                                <Col className="px-0">
                                    <Button  size="sm" onClick={decrement} ><strong>-</strong></Button>
                                </Col>
                                <Col className="px-0">
                                    <Card.Body className="p-0">
                                    <small>{item.qty}</small>
                                    </Card.Body>
                                </Col>
                                <Col className="px-0">
                                    <Button  size="sm" onClick={increment} ><strong>+</strong></Button>
                                </Col>
                            </Row>
                        </Col>
                        <Col xs={2}></Col>
                    </Row>
                 </Col>
                 <Col className="image-col ps-0" xs={4}>
                        <Image src={menuItem?.image} rounded fluid />
                        <div className="image-overlayer"></div>
                        <Button 
                            className="add-button"
                            // variant="outline-primary" 
                            size="sm"
                            onClick={addItemToCart}
                        >
                            <strong>Add</strong>
                        </Button>
                 </Col>
             </Row>
            </Card>
        </>
    )
}

export default MenuItem