import { useEffect, useState } from "react"
import { Card, Col, Row, Button, Image, Form } from "react-bootstrap"
import { useParams } from "react-router"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { addToCart, addToSplit, decreaseSplit, getTableCart, removeFromCart, removeFromSplit, selectCartsData } from "../../../redux/slices/cartSlice"
import { IItem, ISplitItem } from "../../../typings/cart"
import { IMenu } from "../../../typings/menu"
import "./CartItem.css"

interface CartItemProps {
    cartId: string
    itemId: string | undefined
    selectedAll: boolean
}

const CartItem = ({cartId, itemId, selectedAll}: CartItemProps) => {
    const params = useParams<{ shopId: string, tableId: string }>()
    const shopId  = params.shopId
    const tableId  = params.tableId

    const cart = useAppSelector(selectCartsData)
    const cartItem = cart.items.find(item => item._id === itemId)
    const splitItem = cart.split.find(item => item._id === itemId)
    

    // const cartItem = useAppSelector(state => state.carts.data.items.find(item => item._id === itemId))

    const [selected, setSelected] = useState(false)

    const [split, setSplit] = useState<ISplitItem | undefined>({
        _id: '',
        userId: '',
        menuId: null,
        qty: 0,
        splitStatus: '',
    })

    const [item, setItem] = useState<IItem | undefined>({
        _id: "",
        menuId: null,
        qty: 1
    })

    const [qtyLeft, setQtyLeft] = useState(item?.qty)
    

    // setQtyLeft(left)

    useEffect(() => {
        dispatch(getTableCart(tableId))
        setItem(cartItem)
        setSplit(splitItem)
    }, [])

    useEffect(() => {
        setItem(cartItem)
        setSplit(splitItem)
        // setSelected(selectedAll)
        console.log(qtyLeft);
        
    }, [cartItem, splitItem])

    useEffect(()=> {
        if(selectedAll) {
            increment()
        } else {
            removeItemFromSplit()
        }
    }, [selectedAll])

    const dispatch = useAppDispatch()

    // const increment = () => {  //<====================   adds item to Cart
    //     const plusItem = {
    //         menuId: item!.menuId,
    //         qty: 1
    //     }

    //    dispatch(addToCart({
    //     shopId: shopId,
    //     tableId: tableId,
    //     item: plusItem
    //    }))
    // }
    // const decrement = () => {  ////<====================   removes item from Cart
    //   const minusItem = {
    //         menuId: item!.menuId,
    //         qty: 1
    //     }
        
    //    dispatch(removeFromCart({
    //     shopId: shopId,
    //     tableId: tableId,
    //     item: minusItem
    //    }))
    // }
    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelected(!selected)
        const splitExists = item?.menuId._id === split?.menuId._id
        
        // console.log(!selected);
        // console.log("splitExists: ", splitExists)
        if(!selected && !splitExists) {
            console.log("add to split")
            increment()
        } else if (selected && splitExists) {
            console.log("remove from split")
            removeItemFromSplit()
        }
    }

    const increment = () => {   //<====================   adds item to SPLIT Cart
        const plusItem = item!

       dispatch(addToSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: plusItem
       }))

    }

    const decrement = () => {
      const minusItem = item!
        
       dispatch(decreaseSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: minusItem
       }))
    }

    const removeItemFromSplit = () => {
        const minusItem = item!
        dispatch(removeFromSplit({
            shopId: shopId,
            tableId: tableId,
            cartId: cartId,
            item: minusItem
           }))
    }

    return(
        <>
            <Row className="align-items-center">
                <Col className="d-flex p-0" xs={1}>
                    <Form.Group className="ms-3 text-center" controlId="formBasicCheckbox">
                        <Form.Check 
                            type="checkbox" 
                            checked={selectedAll ? true : selected} 
                            onChange={(e) => handleSelect(e)} 
                        />
                    </Form.Group>
                </Col>
                <Col xs={11}>
                    <Card className="CartItem">
                        <Row className="align-items-center">
                            <Col className="image-col pe-0" xs={4}>
                                <Image src={item?.menuId?.image} rounded fluid />
                            </Col>
                            <Col xs={8} className="text-start ps-2">
                                <Row className="my-3">
                                    <Col>
                                        <Card.Subtitle className="ms-3">
                                            {item?.menuId?.name}
                                        </Card.Subtitle>
                                        {/* <Card.Body className="ms-3 p-0">
                                    <small>{item?.menuId?.short_description}</small>
                                </Card.Body> */}
                                    </Col>
                                    <Col>
                                    <Card.Text>
                                       <small> Cart Qty: {item?.qty}</small>
                                    </Card.Text>
                                    </Col>
                                </Row>
                                <Row className="pb-2 align-items-center">
                                    <Col xs={5}>
                                        <Card.Body className="p-0 ms-3">
                                            <small><strong>
                                                £ {item?.menuId?.price}
                                            </strong></small>
                                        </Card.Body>
                                    </Col>
                                    <Col xs={6}>
                                        <Row className="text-center align-items-center">
                                            <Col className="px-0">
                                                {selected
                                                    ? <Button active size="sm" onClick={increment} ><strong>+</strong></Button>
                                                    : <Button disabled size="sm" onClick={increment} ><strong>+</strong></Button>
                                                }
                                            </Col>
                                            <Col className="px-0">
                                                <Card.Body className="p-0">
                                                    <small>{split?.qty}</small>
                                                </Card.Body>
                                            </Col>
                                            <Col className="px-0">
                                                {selected
                                                    ? <Button active size="sm" onClick={decrement} ><strong>-</strong></Button>
                                                    : <Button disabled size="sm" onClick={decrement} ><strong>-</strong></Button>
                                                }
                                                {/* <Button size="sm" onClick={decrement} ><strong>-</strong></Button> */}
                                            </Col>
                                        </Row>
                                    </Col>
                                    {/* <Col xs={2}></Col> */}
                                </Row>
                            </Col>
                        </Row>
                    </Card>
                </Col>
            </Row>
        </>
    )
}

export default CartItem