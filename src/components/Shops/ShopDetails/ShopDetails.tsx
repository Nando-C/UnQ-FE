import { useParams } from "react-router-dom"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectShopsData } from "../../../redux/slices/shopSlice"
import { Card, Row, Col, Button, Image, ListGroup } from "react-bootstrap"
import { FcClock, FcCellPhone, FcAddressBook } from "react-icons/fc"
import "./ShopDetails.css"
import { useState } from "react"
import ShopModal from "../ShopModal/ShopModal"

const ShopDetails = () => {

    const shopListStore = useAppSelector(selectShopsData)

    const params = useParams<{ shopId: string }>()
    const shopId  = params.shopId
    const shop = shopListStore.find(shop => shop._id === shopId)

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return(
        <>
        <Card>
            <Row className="align-items-center">
                <Col xs={12} md={6}>
                    <Image src={shop?.cover} fluid/>
                </Col>
                <Col xs={12} md={6}>
                    <Card.Body className="ms-2">
                        <Card.Title>{shop?.name}</Card.Title>
                        <ListGroup className="align-items-start" variant="flush">
                            <ListGroup.Item>
                                <Card.Text>{shop?.bio}</Card.Text>
                            </ListGroup.Item>
                            <ListGroup.Item>
                            <FcClock className="me-2" size={25}/>
                            {shop?.open_times}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <FcCellPhone className="me-2" size={25}/>
                                {shop?.phone}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <FcAddressBook className="me-2" size={25}/>
                                <Card.Link href={shop?.web_URL}>{shop?.web_URL}</Card.Link>
                            </ListGroup.Item>
                        </ListGroup>
                    </Card.Body>
                    <Button onClick={handleShow} >Edit Details</Button>
                </Col>
            </Row>
        </Card>
        <ShopModal show={show} handleClose={handleClose} shop={shop}/>
        </>
    )
}

export default ShopDetails