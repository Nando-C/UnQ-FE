import { Card, Col, Image, Row } from "react-bootstrap"
import "./CustomerShopCard.css"

interface ShopCardProps {
    name: string
    cover: string
    bio: string
}

const CustomerShopCard = ({
    // _id,
    name,
    cover,
    bio,
}: ShopCardProps) => {
    return(
        <>
        <Card className="CustomerShopCard">
                <Row className="text-start">
                    <Col xs={3}>
                        <Image src={cover} rounded fluid />
                    </Col>
                    <Col className="pt-2" xs={9}>
                        <Card.Subtitle>
                            {name}
                        </Card.Subtitle>
                        <Card.Body className="p-0">
                            <small>{bio}</small>
                        </Card.Body>
                    </Col>
                </Row>
            </Card>
        </>
    )
}

export default CustomerShopCard