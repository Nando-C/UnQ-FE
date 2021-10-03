import { Card, Row, Col, Form, Image } from "react-bootstrap"
import "./Item.css"

const Item = () => {
    return(
        <>
            <Card className="Item p-3">
                        <Card.Title>
                            Item Name
                        </Card.Title>
                <Row className="align-items-center">
                    <Col xs={12} md={3}>
                        <Image src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png" thumbnail fluid />
                    </Col>
                    <Col xs={12} md={3}>
                        <Card.Subtitle>
                            Short Description
                        </Card.Subtitle>
                        <Card.Body>
                            Short description: The best Tacos in town!
                        </Card.Body>
                    </Col>
                    <Col xs={12} md={3}>
                        <Card.Subtitle>
                            Full Description
                        </Card.Subtitle>
                        <Card.Body>
                        The best Burger in town! and the rest of the world! bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla bla
                        </Card.Body>
                    </Col>
                    <Col xs={12} md={3}>
                        <Row className="align-items-center">
                        <Col xs={12} md={6}>
                            <Card.Body>
                                £ 12
                            </Card.Body>
                        </Col>
                        <Col xs={12} md={6}>
                            <Form>
                                <Form.Check
                                    type="switch"
                                    id="custom-switch"
                                // label="Available"
                                />
                            </Form>
                        </Col>
                        </Row>
                    </Col>
                </Row>
            </Card>
        </>
    )
}

export default Item