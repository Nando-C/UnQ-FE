import { useState } from "react"
import { Col, FloatingLabel, Form, ListGroup, Row } from "react-bootstrap"
import { Link } from "react-router-dom"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectShopsData } from "../../../redux/slices/shopSlice"
import ShopCard from "../../Shops/ShopCard/ShopCard"
import CustomerShopCard from "../CustomerShopCard/CustomerShopCard"
import "./AllShopsList.css"

const AllShopsList = () => {
    
    const shopList = useAppSelector(selectShopsData)

    const [query, setQuery] = useState("")

    return(
        <>
            <Row>
                <Col>
                    <Form.Group className="mb-3" controlId="formBasicEmail">
                        <FloatingLabel controlId="floatingInput" label="Search Menu">
                            <Form.Control
                                placeholder="Search Menu"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </FloatingLabel>
                    </Form.Group>
                </Col>
            </Row>
        <ListGroup className="ShopList mb-5" variant="flush">
            {shopList.filter(shop => (
                        shop.name.toLowerCase().includes(query.toLowerCase())
                        || shop.bio.toLowerCase().includes(query.toLowerCase())
                    )
                ).map((shop) => (
                    <ListGroup.Item className="px-0" key={shop._id}>
                        <Link to={`/customer/shop/${shop._id}`}>
                            <CustomerShopCard
                                // _id={shop._id}
                                name={shop.name}
                                cover={shop.cover}
                                bio={shop.bio}
                            />
                        </Link>
                    </ListGroup.Item>
            ))}
        </ListGroup>
        </>
    )
}

export default AllShopsList