import { useEffect, useState } from "react"
import { Card, Col, Image, Row, Button } from "react-bootstrap"
import { useDispatch } from "react-redux"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchMenuItem, fetchSingleShop, selectSelectedMenu, selectSelectedShop } from "../../../redux/slices/shopSlice"
import "./MenuItem.css"

interface MenuItemProps {
    itemId: string 
    shopId: string
}

const MenuItem = ({shopId, itemId}: MenuItemProps) => {
    
    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(fetchSingleShop(shopId))
    }, [])

    const shop = useAppSelector(selectSelectedShop)
    const menuItem = shop?.menu.find(item => item._id === itemId)

    const [qty, setQty] = useState(1)
    const increment = () => {
        const newQty = qty + 1
        setQty(newQty)
    }

    const decrement = () => {
        const newQty = qty - 1
        if (newQty >= 0) {
            setQty(newQty) 
        } else {
            setQty(0)
        }
    }
    
    return(
        <>
         <Card className="">
             <Row>
                 <Col xs={8} className="text-start d-flex flex-column justify-content-between">
                    <Row className="mt-2">
                        <Col>
                            <Card.Subtitle className="ms-3">
                                {menuItem?.name}
                            </Card.Subtitle>
                            <Card.Body className="py-0">
                                <small>{menuItem?.short_description}</small>
                            </Card.Body>
                        </Col>
                    </Row>
                    <Row className="py-1 align-items-center">
                        <Col xs={5}>
                            <Card.Body className="p-0 ms-3">
                            <small><strong>£ {menuItem?.price}</strong></small>
                            </Card.Body>
                        </Col>
                        <Col xs={7}>
                        <Row className="text-center align-items-center">
                            <Col className="px-0">
                                <Button variant="outline-primary" size="sm" onClick={increment} ><strong>+</strong></Button>
                            </Col>
                            <Col className="px-0">
                                <Card.Body className="p-0">
                                <small>{qty}</small>
                                </Card.Body>
                            </Col>
                            <Col className="px-0">
                                <Button variant="outline-primary" size="sm" onClick={decrement} ><strong>-</strong></Button>
                            </Col>
                        </Row>
                        </Col>
                    </Row>
                 </Col>
                 <Col className="ps-0" xs={4}>
                        <Image src={menuItem?.image} rounded fluid />
                        <Button>Add</Button>
                 </Col>
             </Row>
            </Card>
        </>
    )
}

export default MenuItem