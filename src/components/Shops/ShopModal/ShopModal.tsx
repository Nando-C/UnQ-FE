import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { Modal, Button, Form, FloatingLabel, Image } from "react-bootstrap"
import { IShop } from "../../../typings/shop"
import "./ShopModal.css"

interface ShopModalProps {
    show: boolean
    handleClose: ()=> void
    shop: IShop | undefined
}

const ShopModal = (
    {
        show,
        handleClose,
        shop 
    }: ShopModalProps ) => {
    
    const [editShop, setEditShop] = useState<IShop>({
        _id: "",
        name: "",
        cover: "",
        bio: "",
        open_times: "",
        phone: "",
        web_URL: "",
        shopMg: [],
        tables: [],
        menu: []
    })

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
            _id: shop!._id,
            name: shop!.name,
            cover: shop!.cover,
            bio: shop!.bio,
            open_times: shop!.open_times,
            phone: shop!.phone,
            web_URL: shop!.web_URL,
            shopMg: shop!.shopMg,
            tables: shop!.tables,
            menu: shop!.menu
        })
    }, [])

    const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        console.log("imageFile: ", imageFile);
        handleClose()

    }

    return (
        <>
            <Modal className="ShopModal" show={show} onHide={handleClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Shop</Modal.Title>
                </Modal.Header>
                <Modal.Body>

                        
                <Form onSubmit={(e) => handleEdit(e)}>
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
                            <Button variant="dark" className="me-2" onClick={()=> fileInputRef.current?.click()}>
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
                                    onChange={e => setEditShop({ ...editShop, phone: e.target.value })}
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

                <Form.Group className="d-flex justify-content-end">
                    <Button className="mb-2" variant="primary" type="submit">
                        Save Changes
                    </Button>
                </Form.Group>

                    </Form>
                </Modal.Body>
                {/* <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                </Modal.Footer> */}
            </Modal>
        </>
    )
}

export default ShopModal