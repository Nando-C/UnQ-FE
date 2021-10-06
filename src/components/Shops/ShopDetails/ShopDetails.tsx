import { useParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchShopList, selectShopsData } from "../../../redux/slices/shopSlice"
import { Card, Row, Col, Button, Image, ListGroup, Container } from "react-bootstrap"
import { FcClock, FcCellPhone, FcAddressBook } from "react-icons/fc"
import "./ShopDetails.css"
import { useEffect, useState } from "react"
import ShopModal from "../ShopModal/ShopModal"
import ShopMenu from "../ShopMenu/ShopMenu"
import Item from "../Item/Item"
// import { fetchUserData } from "../../../redux/slices/userSlice"
// import { IShop } from "../../../typings/shop"

const ShopDetails = () => {

    // const shopListStore = useAppSelector(selectShopsData)
    const params = useParams<{ shopId: string }>()
    const shopId  = params.shopId
    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
    // const shop = shopListStore.find(shop => shop._id === shopId)

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return(
        <Container>
            <Card className="ShopDetails">
                <Row className="align-items-center">
                    <Col xs={12} md={6}>
                        <Container className="p-3">
                            <Image src={shop?.cover} fluid />
                        </Container>
                    </Col>
                    <Col xs={12} md={6}>
                        <Card.Body className="ms-2">
                            <Card.Title>{shop?.name}</Card.Title>
                            <ListGroup className="align-items-start" variant="flush">
                                <ListGroup.Item>
                                    <Card.Text>{shop?.bio}</Card.Text>
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <FcClock className="me-2" size={25} />
                                    {shop?.open_times}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <FcCellPhone className="me-2" size={25} />
                                    {shop?.phone}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <FcAddressBook className="me-2" size={25} />
                                    <Card.Link href={shop?.web_URL}>{shop?.web_URL}</Card.Link>
                                </ListGroup.Item>
                            </ListGroup>
                        </Card.Body>
                        <Button onClick={handleShow} >Edit Details</Button>
                    </Col>
                </Row>
            </Card>
            <ShopModal show={show} handleClose={handleClose} shopId={shopId}/>
            <ShopMenu shopId={shopId}/> 
        </Container>
    )
}

export default ShopDetails