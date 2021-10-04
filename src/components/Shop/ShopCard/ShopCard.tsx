import { Card, Row, Col, Form, Image } from "react-bootstrap"
import "./ShopCard.css"

interface ShopCardProps {
    name: string
    cover: string
    bio: string
}

const ShopCard = (
    {
        // _id,
        name,
        cover,
        bio,
    }: ShopCardProps) => {

    return(
        <>
            <Card className="Shop p-3">
                <Card.Title>
                    {name}
                </Card.Title>
                <Row className="align-Shops-center">
                    <Col xs={12} md={3}>
                        <Image src={cover} thumbnail fluid />
                    </Col>
                    <Col xs={12} md={9}>
                        <Card.Body>
                            {bio}
                        </Card.Body>
                    </Col>
                </Row>
            </Card>
        </>
    )
}

export default ShopCard