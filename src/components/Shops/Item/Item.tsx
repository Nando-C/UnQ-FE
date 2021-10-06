import { ChangeEvent, useState } from "react"
import { Card, Row, Col, Form, Image, Button } from "react-bootstrap"
import { useParams } from "react-router"
import backend from "../../../backend/backend"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchShopList } from "../../../redux/slices/shopSlice"
import { IMenu } from "../../../typings/menu"
import ItemModal from "../ItemModal/ItemModal"
import "./Item.css"

interface ItemProps {
    itemId: string 
    shopId: string
}

const Item = ({itemId, shopId}: ItemProps) => {

    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
    const menuItem = shop?.menu.find(item => item._id === itemId)

    const [available, setAvailable] = useState(menuItem!.available)

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    const dispatch = useAppDispatch()

    const updateAvailable = async () => {
        const updatedItem = {...menuItem, available :!available}
        const data = await backend.put(`/shops/${shopId}/menu/${itemId}`, updatedItem)
        // console.log("updatedItem: ", updatedItem)
        dispatch(fetchShopList())
    }
    
    return(
        <>
            <Card className="Item p-3">
                <Card.Title>
                    {menuItem?.name}
                </Card.Title>
                <Row className="align-items-center">
                    <Col xs={12} md={3}>
                        <Image src={menuItem?.image} thumbnail fluid />
                    </Col>
                    <Col xs={12} md={3}>
                        <Card.Subtitle>
                            Short Description
                        </Card.Subtitle>
                        <Card.Body>
                            {menuItem?.short_description}
                        </Card.Body>
                    </Col>
                    <Col xs={12} md={3}>
                        <Card.Subtitle>
                            Full Description
                        </Card.Subtitle>
                        <Card.Body>
                            {menuItem?.description}
                        </Card.Body>
                    </Col>
                    <Col xs={12} md={3}>
                        <Row className="align-items-center">
                            <Col xs={12} md={6}>
                                <Card.Body>
                                    £ {menuItem?.price}
                                </Card.Body>
                            </Col>
                            <Col xs={12} md={6}>
                                <Form>
                                    <Form.Check
                                        className="mb-3"
                                        type="switch"
                                        id="custom-switch"
                                        checked={available}
                                        onChange={(e) => {setAvailable(e.target.checked ? true : false)
                                                            updateAvailable()}
                                        }
                                                
                                    // label="Available"
                                    />
                                </Form>
                            </Col>
                        </Row>
                    </Col>
                    <Button className="" onClick={handleShow} >Edit Item</Button>
                </Row>
            </Card>
            <ItemModal shopId={shopId} show={show} handleClose={handleClose} itemId={menuItem!._id}/>
        </>
    )
}

export default Item