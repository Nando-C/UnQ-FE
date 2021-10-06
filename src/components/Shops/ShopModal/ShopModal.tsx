import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { Modal, Button, Form, FloatingLabel, Image } from "react-bootstrap"
import { useHistory } from "react-router-dom"
import backend from "../../../backend/backend"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchShopList } from "../../../redux/slices/shopSlice"
import { fetchUserData } from "../../../redux/slices/userSlice"
import { IShop } from "../../../typings/shop"
import "./ShopModal.css"

interface ShopModalProps {
    show: boolean
    handleClose: ()=> void
    // shop: IShop | undefined
    shopId: string
}

const ShopModal = (
    {
        show,
        handleClose,
        shopId,
    }: ShopModalProps ) => {
        const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
        // console.log("shop: ", shop)
        
    
    const [editShop, setEditShop] = useState<IShop>({
        _id: "",
        name: "",
        cover: "",
        bio: "",
        open_times: "",
        phone: 0,
        web_URL: "",
        shopMg: [],
        tables: [],
        menu: []
    })
    const dispatch = useAppDispatch()
    const history = useHistory()

    const [imageFile, setImageFile] = useState<File | null>()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files
        if(!files) return
        setImageFile(files[0])
        // console.log("imageFile: ", imageFile)
      }

    useEffect(() => {
        setEditShop({
            _id: shop ? shop._id: "",
            name: shop ? shop.name : "",
            cover: shop ? shop.cover : "",
            bio: shop ? shop.bio : "",
            open_times: shop ? shop.open_times : "",
            phone: shop ? shop.phone : 0,
            web_URL: shop ? shop.web_URL : "",
            shopMg: shop ? shop.shopMg : [],
            tables: shop ? shop.tables : [],
            menu: shop ? shop.menu : []
        })
    }, [shop])

    const createShop = async () => {
        const newShop = {
            name: editShop.name,
            bio: editShop.bio,
            open_times: editShop.open_times,
            phone: editShop.phone,
            web_URL: editShop.web_URL,
        }
        const created = await backend.post(`/shops`, newShop)
        console.log("newShop: ", created)
        
        if(imageFile) {
            const newShopCover = new FormData()
            newShopCover.append("cover", imageFile)
            const newCover = await backend.put(`/shops/${created.data._id}/cover`, newShopCover)
            console.log(newCover)
        }
        dispatch(fetchShopList())
        handleClose()
    }

    const updateShop = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        console.log(editShop);

        const data = await backend.put(`/shops/${editShop._id}`, editShop)
        console.log(data)
        if(imageFile) {
            const newShopCover = new FormData()
            newShopCover.append("cover", imageFile)
            const newCover = await backend.put(`/shops/${editShop._id}/cover`, newShopCover)
            console.log(newCover)
        }
        dispatch(fetchShopList())
        // setEditShop({
        //     _id: "",name: "",cover: "",bio: "",open_times: "",phone: 0,web_URL: "",shopMg: [],tables: [],menu: []
        // })
        handleClose()
    }

    const deleteShop = async () => {
        const deleted = await backend.delete(`/shops/${editShop._id}`)
        console.log("Deleted")
        history.push("/")
        handleClose()
    }

    return (
        <>
            <Modal className="ShopModal" show={show} onHide={handleClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Shop</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => updateShop(e)}>
                        <Form.Group className="my-2">
                            <Form.Control
                                type="file"
                                hidden
                                ref={fileInputRef}
                                onChange={handleFile}
                            />
                            <Image
                                src={
                                    imageFile
                                        ? URL.createObjectURL(imageFile)
                                        : editShop.cover || "https://via.placeholder.com/600x600?text=Blog+Image"
                                }
                                height="200px"
                                // width="400px"
                                alt="cover"
                                className="d-block mb-2"
                            />
                            <Button variant="dark" className="me-2" onClick={() => fileInputRef.current?.click()}>
                                Upload Image
                            </Button>
                            <Button variant="outline-dark" className="my-2" onClick={() => setImageFile(null)}>
                                Reset Image
                            </Button>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Name">
                                <Form.Control
                                    placeholder="Name"
                                    value={editShop.name}
                                    onChange={e => setEditShop({ ...editShop, name: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicPassword">
                            <FloatingLabel controlId="ffloatingTextarea" label="Bio">
                                <Form.Control
                                    as="textarea"
                                    placeholder="Bio"
                                    value={editShop.bio}
                                    style={{ height: '200px' }}
                                    onChange={e => setEditShop({ ...editShop, bio: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Open Times">
                                <Form.Control
                                    placeholder="Open Times"
                                    value={editShop.open_times}
                                    onChange={e => setEditShop({ ...editShop, open_times: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Phone Number">
                                <Form.Control
                                    placeholder="Phone Number"
                                    value={editShop.phone}
                                    onChange={e => setEditShop({ ...editShop, phone: parseInt(e.target.value) })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <FloatingLabel controlId="floatingInput" label="Web URL">
                                <Form.Control
                                    placeholder="Web URL"
                                    value={editShop.web_URL}
                                    onChange={e => setEditShop({ ...editShop, web_URL: e.target.value })}
                                />
                            </FloatingLabel>
                        </Form.Group>
                        {(shopId !== "new")
                            ? <Form.Group className="d-flex justify-content-end">
                                <Button variant="outline-danger" className="my-2" onClick={deleteShop}>
                                    Delete Shop
                                </Button>
                                <Button className="my-2" variant="primary" type="submit">
                                    Save Changes
                                </Button>
                            </Form.Group>
                            : <Form.Group className="d-flex justify-content-end">
                                <Button className="my-2" variant="primary" onClick={createShop}>
                                    Create Shop
                                </Button>
                        </Form.Group>
                        }
                        
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default ShopModal